import type { Chain } from "@wormhole-foundation/sdk-base";
import type {
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

// Attestation Receipt contains the id to lookup the attestation
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

export interface RedeemedTransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.DestinationInitiated;
  originTxs: TransactionId<SC>[];
  attestation: Required<AT>;
  destinationTxs?: TransactionId<DC>[];
}

export interface CompletedTransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.DestinationFinalized;
  originTxs: TransactionId<SC>[];
  attestation: AT;
  destinationTxs?: TransactionId<DC>[];
}

export interface FailedTransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain>
  extends BaseTransferReceipt<SC, DC> {
  state: TransferState.Failed;
  originTxs: TransactionId<SC>[];
  destinationTxs?: TransactionId<DC>[];
  attestation?: AT;
  error: string;
}

export function isSourceInitiated<AT>(
  receipt: TransferReceipt<AT>,
): receipt is SourceInitiatedTransferReceipt {
  return receipt.state === TransferState.SourceInitiated;
}

export function isSourceFinalized<AT>(
  receipt: TransferReceipt<AT>,
): receipt is SourceFinalizedTransferReceipt<AT> {
  return receipt.state === TransferState.SourceFinalized;
}

export function isAttested<AT>(
  receipt: TransferReceipt<AT>,
): receipt is AttestedTransferReceipt<AT> {
  return receipt.state === TransferState.Attested;
}

export function isRedeemed<AT>(
  receipt: TransferReceipt<AT>,
): receipt is RedeemedTransferReceipt<AT> {
  return receipt.state === TransferState.DestinationInitiated;
}

export function isCompleted<AT>(
  receipt: TransferReceipt<AT>,
): receipt is CompletedTransferReceipt<AT> {
  return receipt.state === TransferState.DestinationFinalized;
}

export function isFailed<AT>(receipt: TransferReceipt<AT>): receipt is FailedTransferReceipt<AT> {
  return receipt.state < 0;
}

export type TransferReceipt<AT, SC extends Chain = Chain, DC extends Chain = Chain> =
  | FailedTransferReceipt<AT, SC, DC>
  | CreatedTransferReceipt<SC, DC>
  | SourceInitiatedTransferReceipt<SC, DC>
  | SourceFinalizedTransferReceipt<AT, SC, DC>
  | AttestedTransferReceipt<AT, SC, DC>
  | RedeemedTransferReceipt<AT, SC, DC>
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
