import {
  encoding,
  serializeLayout,
  type Chain,
  type Network,
  type Platform,
} from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { EmptyPlatformMap } from "../../protocol.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import "../tokenBridge/automaticTokenBridgeLayout.js";
import "../tokenBridge/tokenBridgeLayout.js";
import type { ProtocolPayload, ProtocolVAA } from "./../../vaa/index.js";

import "../../registry.js";
import { TokenAddress } from "../../types.js";
import { transceiverInstructionLayout } from "./nttLayout.js";

/**
 * @namespace NTT
 */
export namespace NTT {
  const _protocol = "NTT";
  export type ProtocolName = typeof _protocol;
}

export namespace NTTManager {
  /**
   * InboundQueuedTransfer is a queued transfer from another chain
   * @property recipient the recipient of the transfer
   * @property amount the amount of the transfer
   * @property rateLimitExpiryTimestamp the timestamp when the rate limit expires
   */
  export type InboundQueuedTransfer = {
    recipient: string;
    amount: string;
    rateLimitExpiryTimestamp: number;
  };
  /**
   * TransceiverInstruction is a single instruction for the transceiver
   * @property index the index of the instruction, may not be > 255
   * @property payload the payload of the instruction, may not exceed 255 bytes
   */
  export type TransceiverInstruction = {
    index: number;
    payload: Uint8Array;
  };

  // TODO: should layoutify this but couldnt immediately figure out how to
  // specify the length of the array as an encoded value
  export function encodeTransceiverInstructions(ixs: TransceiverInstruction[]) {
    if (ixs.length > 255) throw new Error(`Too many instructions (${ixs.length})`);
    return encoding.bytes.concat(
      new Uint8Array([ixs.length]),
      ...ixs.map((ix) => serializeLayout(transceiverInstructionLayout(), ix)),
    );
  }
}

/**
 * NTTManager is the interface for the NTT manager
 *
 * The NTTManager is responsible for managing the coordination between the token contract and
 * the transceiver(s). It is also responsible for managing the capacity of inbound or outbount transfers.
 *
 * @typeparam N the network
 * @typeparam C the chain
 */
export interface NTTManager<N extends Network, C extends Chain> {
  /**
   * transfer sends a message to the NTT manager to initiate a transfer
   * @param sender the address of the sender
   * @param amount the amount to transfer
   * @param destination the destination chain
   * @param queue whether to queue the transfer if the outbound capacity is exceeded
   */
  transfer(
    sender: AccountAddress<C>,
    amount: bigint,
    destination: ChainAddress,
    queue: boolean,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /**
   * getCurrentOutboundCapacity returns the current outbound capacity of the NTT manager
   */
  getCurrentOutboundCapacity(): Promise<string>;
  /**
   * getCurrentInboundCapacity returns the current inbound capacity of the NTT manager
   * @param fromChain the chain to check the inbound capacity for
   */
  getCurrentInboundCapacity(fromChain: Chain): Promise<string>;
  /**
   * getInboundQueuedTransfer returns the details of an inbound queued transfer
   * @param transceiverMessage the transceiver message
   * @param fromChain the chain the transfer is from
   */
  getInboundQueuedTransfer(
    transceiverMessage: string,
    fromChain: Chain,
  ): Promise<NTTManager.InboundQueuedTransfer | undefined>;
  /**
   * completeInboundQueuedTransfer completes an inbound queued transfer
   * @param transceiverMessage the transceiver message
   * @param token the token to transfer
   * @param fromChain the chain the transfer is from
   * @param payer the address to pay for the transfer
   */
  completeInboundQueuedTransfer(
    transceiverMessage: string,
    token: TokenAddress<C>,
    fromChain: Chain,
    payer: string,
  ): Promise<string>;
}

// TODO: what are the set of attestation types for NTT?
// can we know this ahead of time or does it need to be
// flexible enough for folks to add their own somehow?
type attestation = any;

export interface NTTTransceiver<N extends Network, C extends Chain, A extends attestation> {
  /**
   * redeem calls the `receive*` method on the transceiver
   *
   * @param attestation the attestation to redeem against the transceiver
   * @param sender the address of the sender
   */
  redeem(attestation: A, sender?: AccountAddress<C>): AsyncGenerator<UnsignedTransaction<N, C>>;
}

export namespace WormholeNTTTransceiver {
  const _payloads = ["WormholeTransfer"] as const;
  export type PayloadNames = (typeof _payloads)[number];
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    NTT.ProtocolName,
    PayloadName
  >;
  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    NTT.ProtocolName,
    PayloadName
  >;
}

/**
 * WormholeNTTTransceiver is the interface for the Wormhole NTT transceiver
 *
 * The WormholeNTTTransceiver is responsible for verifying VAAs against the core
 * bridge and signaling the NTTManager that it can mint tokens.
 */
export interface WormholeNTTTransceiver<N extends Network, C extends Chain>
  extends NTTTransceiver<N, C, WormholeNTTTransceiver.VAA> {}

//export interface ZKTransceiver<N extends Network, C extends Chain>
//  extends NTTTransceiver<N, C, Uint8Array> {}

declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToPlatformMapping {
      NTT: EmptyPlatformMap<Platform, NTT.ProtocolName>;
    }
  }
}
