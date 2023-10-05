import { CosmWasmClient, IndexedTx } from "@cosmjs/cosmwasm-stargate";
import {
  ChainName,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  NativeAddress,
  PlatformToChains,
  TokenId,
  UniversalAddress,
  WormholeMessageId,
  keccak256,
  sha256,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import bs58 from "bs58";

import { CosmwasmAddress } from "./address";
import { IBC_PORT, networkChainToChannelId } from "./constants";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmUtils } from "./platformUtils";
import { CosmwasmChainName } from "./types";

import { CosmwasmIbcBridge } from "./protocols/ibc";
import { CosmwasmTokenBridge } from "./protocols/tokenBridge";

export module Gateway {
  export const name: ChainName = "Wormchain";

  export function gatewayAddress(): string {
    const contracts = CosmwasmPlatform.contracts.getContracts(name);
    return contracts.gateway!;
  }

  export function tokenBridgeAddress(): string {
    const contracts = CosmwasmPlatform.contracts.getContracts(name);
    return contracts.tokenBridge!;
  }

  export function coreAddress(): string {
    const contracts = CosmwasmPlatform.contracts.getContracts(name);
    return contracts.coreBridge!;
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

  export async function getIbcBridge(
    rpc?: CosmWasmClient
  ): Promise<CosmwasmIbcBridge> {
    rpc = rpc ? rpc : await getRpc();
    return CosmwasmPlatform.getIbcBridge(rpc);
  }

  // Get the wrapped version of an asset created on wormchain
  // for a given chain
  export async function getWrappedAsset(
    token: TokenId
  ): Promise<CosmwasmAddress> {
    const tb = await getTokenBridge();
    const wrappedAsset = await tb.getWrappedAsset(token);

    // Encode the original address to base58 and add it
    // to the factory address for cw20 style factory token address
    const encodedAddress = bs58.encode(
      wrappedAsset.toUniversalAddress().toUint8Array()
    );
    const factoryAddress = `factory/${gatewayAddress()}/${encodedAddress}`;

    return new CosmwasmAddress(factoryAddress);
  }

  // Returns the destination channel on wormchain for given source chain
  export async function getDestinationChannel(
    chain: CosmwasmChainName,
    rpc?: CosmWasmClient
  ): Promise<string> {
    // @ts-ignore
    if (networkChainToChannelId.has(CosmwasmPlatform.network, chain)) {
      const { dst: channel } = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain
      )!;
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    const queryClient = CosmwasmUtils.asQueryClient(rpc);

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
      const { src: channel } = networkChainToChannelId.get(
        CosmwasmPlatform.network,
        // @ts-ignore
        chain
      )!;
      return channel;
    }

    rpc = rpc ? rpc : await getRpc();
    try {
      const { channel } = await rpc.queryContractSmart(gatewayAddress(), {
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
    //const addr = toNative(chain, asset) as CosmwasmAddress;
    const nativeFlg = CosmwasmPlatform.isNativeDenom(chain, asset) ? 1 : 0;
    tokenId.set([nativeFlg], 0);
    tokenId.set(keccak256(asset).slice(1), 1);
    return tokenId;
  }

  // derive the ics20 token denom from the
  // wrapped denom and destination channel
  export async function deriveIbcDenom(
    chain: CosmwasmChainName,
    denom: string
  ): Promise<CosmwasmAddress> {
    const channel = await getDestinationChannel(chain);
    const hashData = Buffer.from(`transfer/${channel}/${denom}`);
    const hash = Buffer.from(sha256(hashData)).toString("hex");
    return new CosmwasmAddress(`ibc/${hash.toUpperCase()}`);
  }

  export function makeTransferMsg(
    chain: ChainName,
    recipient: NativeAddress<"Cosmwasm">,
    fee: bigint = 0n,
    payload?: string,
    nonce?: number
  ): GatewayTransferWithPayloadMsg | GatewayTransferMsg {
    // Address of recipient is b64 encoded Cosmos bech32 address
    // @ts-ignore
    const address = Buffer.from(recipient.toString()).toString("base64");

    const common = {
      chain: toChainId(chain),
      recipient: address,
      fee: fee.toString(),
      nonce: nonce ?? Math.round(Math.random() * 100000),
    };

    const msg: GatewayTransferWithPayloadMsg | GatewayTransferMsg = payload
      ? ({
          gateway_transfer_with_payload: { ...common, payload: payload },
        } as GatewayTransferWithPayloadMsg)
      : ({ gateway_transfer: { ...common } } as GatewayTransferMsg);

    return msg;
  }

  // TODO: should we be able to get chainfrom tx?
  export function getWormholeMessage(
    chain: ChainName,
    tx: IndexedTx
  ): WormholeMessageId {
    const wasm = tx.events
      .filter(
        (ev) =>
          ev.type === "wasm" &&
          ev.attributes[0].key === "_contract_address" &&
          ev.attributes[0].value === coreAddress()
      )
      .pop();

    const sequence = wasm!.attributes.find((e) => {
      return e.key === "message.sequence";
    })!.value;

    const emitter = wasm!.attributes.find((e) => {
      return e.key === "message.sender";
    })!.value;

    return {
      chain: chain,
      emitter: new UniversalAddress(emitter),
      sequence: BigInt(sequence),
    };
  }
}
