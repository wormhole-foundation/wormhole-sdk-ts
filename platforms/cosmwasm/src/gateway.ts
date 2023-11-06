import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import {
  ChainName,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  IbcBridge,
  TokenBridge,
  TokenId,
  encoding,
  sha256,
  toChainId,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmAddress } from "./address";
import { IBC_TRANSFER_PORT } from "./constants";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmChainName } from "./types";

export module Gateway {
  export const name: "Wormchain" = "Wormchain";

  export function gatewayAddress(): string {
    const { contracts } = CosmwasmPlatform.config[name]!;
    return contracts.gateway!;
  }

  export function tokenBridgeAddress(): string {
    const { contracts } = CosmwasmPlatform.config[name]!;
    return contracts.tokenBridge!;
  }

  export function coreAddress(): string {
    const { contracts } = CosmwasmPlatform.config[name]!;
    return contracts.coreBridge!;
  }

  // Returns RPC client for Wormchain
  export async function getRpc(): Promise<CosmWasmClient> {
    const rpcAddress = CosmwasmPlatform.config[name]!.rpc;
    return await CosmWasmClient.connect(rpcAddress);
  }

  export async function getTokenBridge(rpc?: CosmWasmClient): Promise<TokenBridge<"Cosmwasm">> {
    rpc = rpc ? rpc : await getRpc();
    return CosmwasmPlatform.getTokenBridge(rpc);
  }

  export async function getIbcBridge(rpc?: CosmWasmClient): Promise<IbcBridge<"Cosmwasm">> {
    rpc = rpc ? rpc : await getRpc();
    return CosmwasmPlatform.getIbcBridge(rpc);
  }

  // Get the wrapped version of an asset created on wormchain
  // for a given chain
  export async function getWrappedAsset(token: TokenId): Promise<CosmwasmAddress> {
    const tb = await getTokenBridge();
    const wrappedAsset = await tb.getWrappedAsset(token);

    // Encode the original address to base58 and add it
    // to the factory address for cw20 style factory token address
    const encodedAddress = encoding.b58.encode(wrappedAsset.toUniversalAddress().toUint8Array());
    const factoryAddress = `factory/${gatewayAddress()}/${encodedAddress}`;

    return new CosmwasmAddress(factoryAddress);
  }

  // Gets the the source channel for outgoing transfers from wormchain
  export function getGatewaySourceChannel(chain: CosmwasmChainName): string {
    const channels = CosmwasmPlatform.getIbcChannels(chain);
    if (!channels) throw new Error("No channels configured for chain " + chain);
    if (!(Gateway.name in channels)) throw new Error("No channel configured for chain " + chain);
    return channels[Gateway.name]!;
  }

  // derive the ics20 token denom from the
  // wrapped denom and destination channel
  export function deriveIbcDenom(chain: CosmwasmChainName, denom: string): CosmwasmAddress {
    // Otherwise compute the ibc address from the channel and denom
    const channel = getGatewaySourceChannel(chain);
    const hashData = encoding.toUint8Array(`${IBC_TRANSFER_PORT}/${channel}/${denom}`);
    const hash = encoding.hex.encode(sha256(hashData));
    return new CosmwasmAddress(`ibc/${hash.toUpperCase()}`);
  }

  export function makeTransferMsg(
    chain: ChainName,
    recipient: CosmwasmAddress,
    fee: bigint = 0n,
    payload?: string,
    nonce?: number,
  ): GatewayTransferWithPayloadMsg | GatewayTransferMsg {
    // Address of recipient is b64 encoded Cosmos bech32 address
    const address = encoding.b64.encode(recipient.toUint8Array());

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
}
