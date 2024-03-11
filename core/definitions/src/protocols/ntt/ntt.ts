import { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import "../tokenBridge/automaticTokenBridgeLayout";
import "../tokenBridge/tokenBridgeLayout";
import { EmptyPlatformMap } from "../../protocol";
import { ProtocolPayload, ProtocolVAA, VAA } from "../../vaa";
import { ChainAddress, NativeAddress } from "../../address";
import { UnsignedTransaction } from "../../unsignedTransaction";

import "../../registry";
declare module "../../registry" {
  export namespace WormholeRegistry {
    interface ProtocolToPlatformMapping {
      NTT: EmptyPlatformMap<Platform, NTT.ProtocolName>;
    }
  }
}

/**
 * @namespace NTT
 */
export namespace NTT {
  const _protocol = "NTT";
  /** The compile time type of the NTT protocol */
  export type ProtocolName = typeof _protocol;

  const _payloads = ["WormholeTransfer"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAAs emitted from the NTT protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;

  export type InboundQueuedTransfer = {
    recipient: string;
    amount: string;
    rateLimitExpiryTimestamp: number;
  };
}

export interface NTT<N extends Network, C extends Chain> {
  // invoke `transfer` against the NTTManager
  transfer(
    sender: NativeAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    // ... TODO: options? skip relay?
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  // TODO: only for manual NTT?
  // invoke `receiveMessage` against the WormholeTransceiver
  redeem(
    vaa: VAA<"NTT:WormholeTransfer">,
    sender?: NativeAddress<C>,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  getCurrentOutboundCapacity(): Promise<string>;
  getCurrentInboundCapacity(fromChain: Chain): Promise<string>;

  getInboundQueuedTransfer(
    transceiverMessage: string,
    fromChain: Chain,
  ): Promise<NTT.InboundQueuedTransfer | undefined>;
  completeInboundQueuedTransfer(
    transceiverMessage: string,
    fromChain: Chain,
    payer: string,
  ): Promise<string>;
}
