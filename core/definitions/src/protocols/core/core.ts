import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { AccountAddress } from "../../address.js";
import type { WormholeMessageId } from "../../attestation.js";
import type { TxHash } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import type { VAA } from "./../../vaa/index.js";

import "../../registry.js";
import type { EmptyPlatformMap } from "../../protocol.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      WormholeCore: WormholeCore<N, C>;
    }
    interface ProtocolToPlatformMapping {
      WormholeCore: EmptyPlatformMap<"WormholeCore">;
    }
  }
}

export namespace WormholeCore {
  export interface GuardianSet {
    index: number;
    keys: string[];
    expiry: bigint;
  }
}

/**
 * WormholeCore provides a consistent interface to interact
 * with the Wormhole core messaging protocol.
 *
 */
export interface WormholeCore<N extends Network = Network, C extends Chain = Chain> {
  /** Get the fee for publishing a message */
  getMessageFee(): Promise<bigint>;

  /** Get the current guardian set index */
  getGuardianSetIndex(): Promise<number>;

  /** Get the guardian set data corresponding to the index */
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet>;

  /**
   * Publish a message
   *
   * @param sender The address of the sender
   * @param message The message to send
   * @param nonce A number that may be set if needed for the application, may be 0 if unneeded
   * @param consistencyLevel The consistency level to reach before the guardians should sign the message
   *  see {@link https://docs.wormhole.com/wormhole/reference/glossary#consistency-level | the docs} for more information
   *
   * @returns a stream of unsigned transactions to be signed and submitted on chain
   */
  publishMessage(
    sender: AccountAddress<C>,
    message: string | Uint8Array,
    nonce: number,
    consistencyLevel: number,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /**
   * Verify a VAA against the core contract
   * @param sender the sender of the transaction
   * @param vaa the VAA to verify
   *
   * @returns a stream of unsigned transactions to be signed and submitted on chain
   */
  verifyMessage(sender: AccountAddress<C>, vaa: VAA): AsyncGenerator<UnsignedTransaction<N, C>>;

  /**
   * Parse a transaction to get its message id
   *
   * @param txid the transaction hash to parse
   *
   * @returns the message ids produced by the transaction
   */
  parseTransaction(txid: TxHash): Promise<WormholeMessageId[]>;

  /**
   * Parse a transaction to get the VAA message it produced
   *
   * @param txid the transaction hash to parse
   *
   * @returns the VAA message produced by the transaction
   */
  parseMessages(txid: TxHash): Promise<VAA<"Uint8Array">[]>;
}
