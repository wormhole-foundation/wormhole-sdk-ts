import { Chain } from "@wormhole-foundation/sdk-base";
import {
  Attestation,
  AttestationId,
  ProtocolName,
  TokenId,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";

// Transfer state machine states
export enum TransferState {
  Failed = -1,
  Created = 0, // The TokenTransfer object is created
  SourceInitiated, // Source chain transactions are submitted
  SourceFinalized, // Source chain transactions are finalized or whenever we have a message id
  Attested, // VAA or Circle Attestation is available
  DestinationInitiated, // Attestation is submitted to destination chain
  DestinationFinalized, // Destination transaction is finalized
}

export const ErrInvalidStateTransition = (msg: string) =>
  new Error(`Invalid state transition: ${msg}`);

// Attestation Receipt contains
// the id to lookup the attestation
// and possibly a cached attestation
export type AttestationReceipt<PN extends ProtocolName = ProtocolName> = {
  id: AttestationId<PN>;
  attestation?: Attestation<PN>;
};

// Base type for common properties
interface BaseTransferReceipt<SC extends Chain, DC extends Chain> {
  from: SC;
  to: DC;
  state: TransferState;
}

export interface CreatedTransferReceipt<SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.Created;
}

export interface SourceInitiatedTransferReceipt<SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.SourceInitiated;
  originTxs: TransactionId<SC>[];
}

export interface SourceFinalizedTransferReceipt<
  AT,
  SC extends Chain = Chain,
  DC extends Chain = Chain,
> extends BaseTransferReceipt<SC, DC> {
  state: TransferState.SourceFinalized;
  originTxs: TransactionId<SC>[];
  attestation: AT;
}

export interface AttestedTransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.Attested;
  originTxs: TransactionId<SC>[];
  attestation: Required<AT>;
}

export interface CompletedTransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.DestinationInitiated | TransferState.DestinationFinalized;
  originTxs: TransactionId<SC>[];
  attestation: AT;
  destinationTxs?: TransactionId<DC>[];
}

export function isCreated(receipt: TransferReceipt<any>): receipt is CreatedTransferReceipt {
  return receipt.state === TransferState.Created;
}

export function isSourceInitiated<AT>(
  receipt: TransferReceipt<AT>,
): receipt is SourceInitiatedTransferReceipt {
  return receipt.state === TransferState.SourceInitiated;
}

export function hasSourceInitiated<AT>(
  receipt: TransferReceipt<AT>,
): receipt is
  | SourceInitiatedTransferReceipt
  | SourceFinalizedTransferReceipt<AT>
  | AttestedTransferReceipt<AT>
  | CompletedTransferReceipt<AT> {
  return receipt.state >= TransferState.SourceInitiated;
}

export function isSourceFinalized<AT>(
  receipt: TransferReceipt<AT>,
): receipt is SourceFinalizedTransferReceipt<AT> {
  return receipt.state === TransferState.SourceFinalized;
}

export function hasSourceFinalized<AT>(
  receipt: TransferReceipt<AT>,
): receipt is
  | SourceFinalizedTransferReceipt<AT>
  | AttestedTransferReceipt<AT>
  | CompletedTransferReceipt<AT> {
  return receipt.state >= TransferState.SourceFinalized;
}

export function isAttested<AT>(
  receipt: TransferReceipt<AT>,
): receipt is AttestedTransferReceipt<AT> {
  return receipt.state === TransferState.Attested;
}

export function hasAttested<AT>(
  receipt: TransferReceipt<AT>,
): receipt is AttestedTransferReceipt<AT> | CompletedTransferReceipt<AT> {
  return receipt.state >= TransferState.Attested;
}

export function isCompleted<AT>(
  receipt: TransferReceipt<AT>,
): receipt is CompletedTransferReceipt<AT> {
  return receipt.state > TransferState.Attested;
}

export type TransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain> =
  | CreatedTransferReceipt<SC, DC>
  | SourceInitiatedTransferReceipt<SC, DC>
  | SourceFinalizedTransferReceipt<AT, SC, DC>
  | AttestedTransferReceipt<AT, SC, DC>
  | CompletedTransferReceipt<AT, SC, DC>;

// Quote with optional relayer fees if the transfer
// is requested to be automatic
export interface TransferQuote {
  // How much of what token will be deducted from sender
  // Note: This will include fees charged for a full
  // estimate of the amount taken from the sender
  sourceToken: {
    token: TokenId;
    amount: bigint;
  };
  // How much of what token will be minted to the receiver
  // Note: This will _not_ include native gas if requested
  destinationToken: {
    token: TokenId;
    amount: bigint;
  };
  // If the transfer being quoted is automatic
  // a relayer fee may apply
  relayFee?: {
    token: TokenId;
    amount: bigint;
  };
  // If the transfer being quoted asked for native gas dropoff
  // this will contain the amount of native gas that is to be minted
  // on the destination chain given the current swap rates
  destinationNativeGas?: bigint;
}
