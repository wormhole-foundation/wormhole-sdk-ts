import {
  ChainName,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  isGatewayTransferMsg,
  PlatformToChains,
  TokenId,
  keccak256,
  sha256,
  toChainId,
  toChainName,
} from "@wormhole-foundation/connect-sdk";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import bs58 from "bs58";

import { IBC_PORT, networkChainToChannelId } from "./constants";
import { CosmwasmUtils } from "./platformUtils";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmAddress } from "./address";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";
import { CosmwasmChainName } from "./types";

export module Gateway {
  export const name: ChainName = "Wormchain";

  export function address(): string {
    return CosmwasmPlatform.contracts.getContracts(name).gateway!;
  }

  // Returns RPC client for Wormchain
  export async function getRpc(): Promise<CosmWasmClient> {
    const rpcAddress = CosmwasmPlatform.conf[name]!.rpc;
    return await CosmWasmClient.connect(rpcAddress);
  }

  export async function getTokenBridge(
    rpc?: CosmWasmClient
  ): Promise<CosmwasmTokenBridge> {
    rpc = rpc ? rpc : await getRpc();
    return CosmwasmPlatform.getTokenBridge(rpc);
  }

  // Get the wrapped version of an asset created on wormchain
  // for a given chain
  export async function getWrappedAsset(
    token: TokenId,
    chain: PlatformToChains<"Cosmwasm">
  ): Promise<CosmwasmAddress> {
    const tb = await getTokenBridge();
    const wrappedAsset = await tb.getWrappedAsset(token);

    // TODO:
    if (CosmwasmPlatform.isNativeDenom(chain, wrappedAsset.toString()))
      return wrappedAsset as unknown as CosmwasmAddress;

    // Encode the original address to base58 and add it
    // to the factory address for cw20 style factory token address
    const encodedAddress = bs58.encode(
      wrappedAsset.toUniversalAddress().toUint8Array()
    );
    const factoryAddress = `factory/${address()}/${encodedAddress}`;

    return await deriveIbcDenom(chain, factoryAddress);
  }

  // Returns the destination channel on wormchain for given source chain
  export async function getDestinationChannel(
    chain: CosmwasmChainName,
    rpc?: CosmWasmClient
  ): Promise<string> {
    // @ts-ignore
    if (networkChainToChannelId.has(CosmwasmPlatform.network, chain)) {
      const [_, channel] = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain
      );
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    const queryClient = CosmwasmUtils.getQueryClient(rpc);

    const sourceChannel = await getSourceChannel(chain, rpc);
    const conn = await queryClient.ibc.channel.channel(IBC_PORT, sourceChannel);
    const destChannel = conn.channel?.counterparty?.channelId;
    if (!destChannel) {
      throw new Error(`No destination channel found on chain ${chain}`);
    }
    return destChannel;
  }

  // Gets the source channel on wormchain for a given chain
  export async function getSourceChannel(
    chain: CosmwasmChainName,
    rpc?: CosmWasmClient
  ): Promise<string> {
    // @ts-ignore
    if (networkChainToChannelId.has(CosmwasmPlatform.network, chain)) {
      const [channel, _] = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain
      );
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    try {
      const { channel } = await rpc.queryContractSmart(address(), {
        ibc_channel: { chain_id: toChainId(chain) },
      });
      return channel;
    } catch {
      throw new Error("No source channel found for chain " + chain);
    }
  }

  // Derive the Token Address with context for whether or not its managed
  // https://github.com/wormhole-foundation/wormhole/blob/251e6c4a6478379ff862aed08d835f9022ef4143/cosmwasm/contracts/token-bridge/src/token_address.rs#L12
  export function deriveTokenAddress(
    chain: ChainName,
    asset: string
  ): Uint8Array {
    const tokenId = new Uint8Array(32);
    const nativeFlg = CosmwasmPlatform.isNativeDenom(chain, asset) ? 1 : 0;
    tokenId.set([nativeFlg], 0);
    tokenId.set(keccak256(asset).slice(1), 1);
    return tokenId;
  }

  export async function deriveIbcDenom(
    chain: CosmwasmChainName,
    denom: string
  ): Promise<CosmwasmAddress> {
    const channel = await getDestinationChannel(chain);
    const hashData = Buffer.from(`transfer/${channel}/${denom}`);
    const hash = Buffer.from(sha256(hashData)).toString("hex");
    return new CosmwasmAddress(`ibc/${hash.toUpperCase()}`);
  }

  export async function ibcTransferPending(
    payload: GatewayTransferMsg | GatewayTransferWithPayloadMsg,
    rpc?: CosmWasmClient
  ): Promise<boolean> {
    rpc = rpc ? rpc : await getRpc();

    const finalDest = toChainName(
      isGatewayTransferMsg(payload)
        ? payload.gateway_transfer.chain
        : payload.gateway_transfer_with_payload.chain
    );

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64"
    );

    // Find the transaction with matching payload
    const txResults = await rpc.searchTx([
      {
        key: "wasm.transfer_payload",
        value: encodedPayload,
      },
    ]);

    if (txResults.length === 0)
      throw new Error(
        `No matching transaction found for payload: ${encodedPayload}`
      );

    // just take the first
    const [res] = txResults;

    // Find IBC the sequence
    let sequence: number | undefined;
    for (const ev of res.events) {
      if (ev.type !== "send_packet") continue;
      for (const attr of ev.attributes) {
        if (attr.key !== "packet_sequence") continue;
        sequence = Number(attr.value);
      }
    }

    if (!sequence)
      throw new Error("No event found to identify sequence number");

    const srcChannel = await getSourceChannel(
      finalDest as CosmwasmChainName,
      rpc
    );

    const queryClient = CosmwasmPlatform.getQueryClient(rpc);

    try {
      await queryClient.ibc.channel.packetCommitment(
        IBC_PORT,
        srcChannel,
        Number(sequence)
      );
      return true;
    } catch (e) {}

    return false;
  }
}
