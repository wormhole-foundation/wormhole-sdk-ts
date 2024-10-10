import type { Chain, LayoutToType, Network } from "@wormhole-foundation/sdk-base";
import { deserializeLayout, serializeLayout } from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { TokenAddress, TokenId } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import type { ProtocolVAA } from "./../../vaa/index.js";
import { porticoFlagSetLayout, porticoPayloadLayout } from "./porticoLayout.js";
import type { EmptyPlatformMap } from "../../protocol.js";

import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      PorticoBridge: PorticoBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      PorticoBridge: EmptyPlatformMap<"PorticoBridge">;
    }
  }
}

export namespace PorticoBridge {
  const _protocol = "PorticoBridge";
  /** The compile time protocol name type for Portico Bridge */
  export type ProtocolName = typeof _protocol;

  export interface SwapAmounts {
    minAmountStart: bigint;
    minAmountFinish: bigint;
  }

  export type Quote = {
    swapAmounts: SwapAmounts;
    relayerFee: bigint;
  };

  const _transferPayloads = ["Transfer"] as const;
  const _payloads = [..._transferPayloads] as const;

  export type TransferPayloadNames = (typeof _transferPayloads)[number];
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAA types emitted by the PorticoBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload = LayoutToType<typeof porticoPayloadLayout>;
  export type FlagSet = LayoutToType<typeof porticoFlagSetLayout>;

  export const deserializePayload = (data: Uint8Array): PorticoBridge.Payload => {
    return deserializeLayout(porticoPayloadLayout, data);
  };

  export const serializePayload = (msg: PorticoBridge.Payload): Uint8Array => {
    return serializeLayout(porticoPayloadLayout, msg);
  };

  export const deserializeFlagSet = (data: Uint8Array): FlagSet => {
    return deserializeLayout(porticoFlagSetLayout, data);
  };

  export const serializeFlagSet = (flags: FlagSet): Uint8Array => {
    return serializeLayout(porticoFlagSetLayout, flags);
  };
}

/**
 * PorticoBridge provides a consistent interface to interact with
 * the Portico bridge contracts.
 */
export interface PorticoBridge<N extends Network = Network, C extends Chain = Chain> {
  // Checks if a transfer VAA has been redeemed
  isTransferCompleted(vaa: PorticoBridge.VAA): Promise<boolean>;

  /** Initiate a transfer of some token to another chain */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    destToken: TokenId,
    destPorticoAddress: string,
    quote: PorticoBridge.Quote,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /** Redeem a transfer VAA to receive the tokens on this chain */
  redeem(
    sender: AccountAddress<C>,
    vaa: PorticoBridge.VAA,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /** quote token conversion */
  quoteSwap(
    input: TokenAddress<C>,
    output: TokenAddress<C>,
    tokenGroup: string,
    amount: bigint,
  ): Promise<bigint>;

  /** quote relay on destination with conversion */
  quoteRelay(token: TokenAddress<C>, destination: TokenAddress<C>): Promise<bigint>;

  /** Get the "highway" token for this token */
  getTransferrableToken(address: string): Promise<TokenId>;

  /** Tokens supported on this chain */
  supportedTokens(): { group: string; token: TokenId }[];

  /** Get the group that a token belongs to e.g. ETH, WETH, wstETH, USDT */
  getTokenGroup(address: string): string;

  /** Get the Portico contract address for the token group */
  getPorticoAddress(group: string): string;
}
