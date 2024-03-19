import {
  encoding,
  type Chain,
  type Network,
  type Platform,
  serializeLayout,
} from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { EmptyPlatformMap } from "../../protocol.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import "../tokenBridge/automaticTokenBridgeLayout.js";
import "../tokenBridge/tokenBridgeLayout.js";
import type { ProtocolPayload, ProtocolVAA, VAA } from "./../../vaa/index.js";

import "../../registry.js";
import { TokenAddress } from "../../types.js";
import { transceiverInstructionLayout } from "./nttLayout.js";
declare module "../../registry.js" {
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

  export type TransceiverInstruction = {
    index: number;
    payload: Uint8Array;
  };

  export function encodeTransceiverInstructions(ixs: TransceiverInstruction[]) {
    if (ixs.length > 255) throw new Error(`Too many instructions (${ixs.length})`);
    return encoding.bytes.concat(
      new Uint8Array([ixs.length]),
      ...ixs.map((ix) => serializeLayout(transceiverInstructionLayout(), ix)),
    );
  }
}

export interface NTT<N extends Network, C extends Chain> {
  // invoke `transfer` against the NTTManager
  transfer(
    sender: AccountAddress<C>,
    token: TokenAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    // ... TODO: options? skip relay?
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  // TODO: only for manual NTT?
  // invoke `receiveMessage` against the WormholeTransceiver
  redeem(
    vaa: VAA<"NTT:WormholeTransfer">,
    token: TokenAddress<C>,
    sender?: AccountAddress<C>,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  getCurrentOutboundCapacity(token: TokenAddress<C>): Promise<string>;
  getCurrentInboundCapacity(fromChain: Chain, token: TokenAddress<C>): Promise<string>;

  getInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
  ): Promise<NTT.InboundQueuedTransfer | undefined>;
  completeInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
    payer: string,
  ): Promise<string>;
}
