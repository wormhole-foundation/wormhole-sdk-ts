import type { TokenId } from "@wormhole-foundation/sdk-definitions";
import type { AttestationReceipt, TransferReceipt } from "../types.js";
import type { amount } from "@wormhole-foundation/sdk-base";

// Extend Options to provide custom options
// to use for the transfer
export interface Options {}

// Transfer parameters to be validated
// plus any additional options defined by the Route
export interface TransferParams<OP> {
  amount: string;
  options?: OP;
}

export type Receipt<AT extends AttestationReceipt = AttestationReceipt> = TransferReceipt<AT>;

// Transfer params after being validated.
// Will contain populated options as well
// as normalized values for things like amount
export interface ValidatedTransferParams<OP> extends Required<TransferParams<OP>> {}

// Result of calling validate, contains a valid flag to
// indicate whether or not the options passed as input are
// valid for a given route, and if not, an error describing why.
// Also contains the ValidatedTransferParams to be used
// by other methods in the route
export type ValidationResult<OP> =
  | { params: ValidatedTransferParams<OP>; valid: true }
  | { params: TransferParams<OP>; valid: false; error: Error };

export type QuoteResult<
  OP,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  D = any,
> = Quote<OP, VP, D> | QuoteError;

// Quote containing expected details of the transfer
export type Quote<
  OP,
  VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>,
  D = any,
> = {
  success: true;

  // The transfer params which were use as the input for this quote
  params: VP;

  // The source and destination tokens
  sourceToken: {
    token: TokenId;
    amount: amount.Amount;
  };
  destinationToken: {
    token: TokenId;
    amount: amount.Amount;
  };

  // If the transfer being quoted is automatic
  // a relayer fee may apply
  relayFee?: {
    token: TokenId;
    amount: amount.Amount;
  };

  // If the transfer being quoted asked for native gas dropoff
  // this will contain the amount of native gas that is to be minted
  // on the destination chain given the current swap rates
  destinationNativeGas?: amount.Amount;

  // Route-specific quote details, optional
  details?: D;
};

export type QuoteError = {
  success: false;
  error: Error;
};
