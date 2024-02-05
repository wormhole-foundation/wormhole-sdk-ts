import {
  LayoutToType,
  Network,
  Platform,
  PlatformToChains,
  deserializeLayout,
  serializeLayout,
} from "@wormhole-foundation/sdk-base";
import { AccountAddress, ChainAddress } from "../address";
import "../payloads/portico";
import { porticoFlagSetLayout, porticoPayloadLayout } from "../payloads/portico";
import { EmptyPlatformMap } from "../protocol";
import { TokenId, TokenAddress } from "../types";
import { UnsignedTransaction } from "../unsignedTransaction";
import { ProtocolVAA } from "../vaa";

declare global {
  namespace Wormhole {
    export interface ProtocolToPlatformMapping {
      PorticoBridge: EmptyPlatformMap<Platform, PorticoBridge.ProtocolName>;
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
    amountFinish: bigint;
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
export interface PorticoBridge<
  N extends Network,
  P extends Platform,
  C extends PlatformToChains<P>,
> {
  // Checks if a transfer VAA has been redeemed
  //isTransferCompleted(vaa: PorticoBridge.VAA): Promise<boolean>;

  /** Initiate a transfer of some token to another chain */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    destToken: TokenId,
    quote: PorticoBridge.Quote,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /** Redeem a transfer VAA to receive the tokens on this chain */
  redeem(
    sender: AccountAddress<C>,
    vaa: PorticoBridge.VAA,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /** quote token conversion */
  quoteSwap(input: TokenAddress<C>, output: TokenAddress<C>, amount: bigint): Promise<bigint>;
  /** quote relay on destination with conversion */
  quoteRelay(token: TokenAddress<C>, destination: TokenAddress<C>): Promise<bigint>;

  getTransferrableToken(address: string): TokenId;
}
