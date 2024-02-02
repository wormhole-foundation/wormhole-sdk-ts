import {
  CONFIG,
  Chain,
  ChainContext,
  GatewayTransferMsg,
  GatewayTransferWithPayloadMsg,
  Network,
  TokenId,
  encoding,
  sha256,
  toChainId,
} from "@wormhole-foundation/connect-sdk";

import { CosmwasmAddress } from "./address";
import { IBC_TRANSFER_PORT } from "./constants";
import { CosmwasmPlatform } from "./platform";
import { CosmwasmChains, CosmwasmPlatformType } from "./types";

export class Gateway<N extends Network> extends ChainContext<
  N,
  CosmwasmPlatformType,
  typeof Gateway.chain
> {
  static chain: "Wormchain" = "Wormchain";

  static gatewayAddress = (network: Network): string =>
    CONFIG[network].chains[Gateway.chain]!.contracts.gateway!;
  static tokenBridgeAddress = (network: Network): string =>
    CONFIG[network].chains[Gateway.chain]!.contracts.tokenBridge!;
  static coreAddress = (network: Network): string =>
    CONFIG[network].chains[Gateway.chain]!.contracts.coreBridge!;

  // Get the wrapped version of an asset created on wormchain
  // for a given chain
  async getWrappedAsset(token: TokenId): Promise<CosmwasmAddress> {
    const tb = await this.getTokenBridge();
    const wrappedAsset = new CosmwasmAddress(await tb.getWrappedAsset(token));

    // Encode the original address to base58 and add it
    // to the factory address for cw20 style factory token address
    const encodedAddress = encoding.b58.encode(wrappedAsset.toUniversalAddress().toUint8Array());
    const factoryAddress = `factory/${Gateway.gatewayAddress(this.network)}/${encodedAddress}`;

    return new CosmwasmAddress(factoryAddress);
  }

  // Gets the the source channel for outgoing transfers from wormchain
  static getGatewaySourceChannel<N extends Network, C extends CosmwasmChains>(
    network: N,
    chain: C,
  ): string {
    const channels = CosmwasmPlatform.getIbcChannels(network, chain);
    if (!channels) throw new Error("No channels configured for chain " + chain);
    if (!(Gateway.chain in channels)) throw new Error("No channel configured for chain " + chain);
    return channels[Gateway.chain]!;
  }

  // derive the ics20 token denom from the
  // wrapped denom and destination channel
  static deriveIbcDenom<N extends Network, C extends CosmwasmChains>(
    network: N,
    chain: C,
    denom: string,
  ): CosmwasmAddress {
    // Otherwise compute the ibc address from the channel and denom
    const channel = this.getGatewaySourceChannel(network, chain);
    const hashData = encoding.bytes.encode(`${IBC_TRANSFER_PORT}/${channel}/${denom}`);
    const hash = encoding.hex.encode(sha256(hashData));
    return new CosmwasmAddress(`ibc/${hash.toUpperCase()}`);
  }

  static makeTransferMsg(
    chain: Chain,
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
