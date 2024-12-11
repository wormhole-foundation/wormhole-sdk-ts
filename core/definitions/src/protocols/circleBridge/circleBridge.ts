import type { Chain, LayoutToType, Network } from "@wormhole-foundation/sdk-base";
import {
  deserializeLayout,
  encoding,
  lazyInstantiate,
  serializeLayout,
} from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress } from "../../address.js";
import type { CircleMessageId } from "../../attestation.js";
import type { TokenId } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";

import "./automaticCircleBridgeLayout.js";
import { circleMessageLayout } from "./circleBridgeLayout.js";

import type { EmptyPlatformMap } from "../../protocol.js";
import { keccak256 } from "../../utils.js";
import type { ProtocolPayload, ProtocolVAA } from "./../../vaa/index.js";
import { payloadDiscriminator } from "./../../vaa/index.js";

import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      CircleBridge: CircleBridge<N, C>;
      AutomaticCircleBridge: AutomaticCircleBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      CircleBridge: EmptyPlatformMap<"CircleBridge">;
      AutomaticCircleBridge: EmptyPlatformMap<"AutomaticCircleBridge">;
    }
  }
}

export namespace CircleBridge {
  const _protocol = "CircleBridge";
  /** The compile time type for the CircleBridge protocol */
  export type ProtocolName = typeof _protocol;

  const _payloads = ["Message"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  export type Message = LayoutToType<typeof circleMessageLayout>;

  /** Circle message and attestation if available */
  export type Attestation = {
    message: Message;
    attestation?: string;
  };

  export const isCircleAttestation = (thing: any): thing is Attestation => {
    return (<Attestation>thing).message !== undefined;
  };

  export const deserialize = (data: Uint8Array): [CircleBridge.Message, string] => {
    const msg = deserializeLayout(circleMessageLayout, data);
    const messsageHash = encoding.hex.encode(keccak256(data), true);
    return [msg, messsageHash];
  };

  export const serialize = (msg: CircleBridge.Message): Uint8Array => {
    return serializeLayout(circleMessageLayout, msg);
  };
}

export namespace AutomaticCircleBridge {
  const _protocol = "AutomaticCircleBridge";
  export type ProtocolName = typeof _protocol;

  const _payloads = ["DepositWithPayload", "TransferWithRelay"] as const;
  export type PayloadNames = (typeof _payloads)[number];

  /** The VAA types that are emitted from the AutomaticCirlceBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;

  export const getTransferDiscriminator = lazyInstantiate(() =>
    payloadDiscriminator([_protocol, _payloads]),
  );
}

export type CircleTransferMessage = {
  from: ChainAddress;
  to: ChainAddress;
  token: TokenId;
  amount: bigint;
  message: CircleBridge.Message;
  id: CircleMessageId;
};

export type CircleTransferDetails = {
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export function isCircleTransferDetails(thing: any): thing is CircleTransferDetails {
  return (
    (<CircleTransferDetails>thing).amount !== undefined &&
    (<CircleTransferDetails>thing).from !== undefined &&
    (<CircleTransferDetails>thing).to !== undefined
  );
}

/**
 * CircleBridge protocol definition, providing a consistent client
 * interface to the CircleBridge protocol (CCTP).
 *
 * Find the source contracts here: ${@link https://github.com/circlefin/evm-cctp-contracts}
 *
 */
export interface CircleBridge<N extends Network = Network, C extends Chain = Chain> {
  /**
   * Redeem a circle transfer against the Circle Bridge
   *
   * @param sender The address of the sender
   * @param message The Circle message to redeem
   * @param attestation The attestation, from the Circle attestation service
   *
   * @returns a stream of unsigned transactions to be signed and submitted on chain
   */
  redeem(
    sender: AccountAddress<C>,
    message: CircleBridge.Message,
    attestation: string,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /**
   * Initiate a transfer through the Circle CCTP Bridge
   *
   * @param sender the sender of the transaction
   * @param recipient the chain and address of the recipient of the transfer
   * @param amount how much to send in base units
   */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /**
   * Check if a transfer has been completed according to the bridge contract
   *
   * @param message The message to check
   */
  isTransferCompleted(message: CircleBridge.Message): Promise<boolean>;
  /**
   * Grabs the logs from the transaction and parse the circle message
   *
   * @param txid The transaction hash from which to parse a message
   *
   * @returns The parsed CircleTransferMessage
   */
  parseTransactionDetails(txid: string): Promise<CircleTransferMessage>;
}

/**
 * AutomaticCircleBridge protocol definition, providing a consistent client
 * interface for the CircleBridge protocol with Automatic delivery.
 */
export interface AutomaticCircleBridge<N extends Network = Network, C extends Chain = Chain> {
  /**
   * Get the fee required by the relayer to cover the costs of redemption on the destination chain
   *
   * @param destination The destination chain for which to get a fee quote
   * @returns the fee required by the relayer to cover the costs of redemption on the destination chain
   */
  getRelayerFee(destination: Chain): Promise<bigint>;
  /**
   *
   * @param sender address of the transaction sender
   * @param recipient address of the destination chain recipient
   * @param amount how much to send, in base units
   * @param nativeGas if set, determines how much native gas should be received by the recipient
   */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /** Amount of native tokens a user would receive by swapping x amount of sending tokens */
  nativeTokenAmount(amount: bigint): Promise<bigint>;
  /** Maximum amount of sending tokens that can be swapped for native tokens */
  maxSwapAmount(): Promise<bigint>;
}
