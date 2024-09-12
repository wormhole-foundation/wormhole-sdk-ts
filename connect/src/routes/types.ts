import type { TokenId } from "@wormhole-foundation/sdk-definitions";
import type { AttestationReceipt, TransferReceipt } from "../types.js";
import { amount } from "@wormhole-foundation/sdk-base";
import type { QuoteWarning } from "../warnings.js";

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

  // If the transfer being quoted has any warnings
  // such as high slippage or a delay, they will be included here
  warnings?: QuoteWarning[];

  // Estimated time to completion in milliseconds
  eta?: number;
};

export type QuoteError = {
  success: false;
  error: Error;
};

// Special error to return from quote() or validate() when the
// given transfer amount is too small. Used to helpfully
// show a minimum amount in the interface.
export class MinAmountError extends Error {
  min: amount.Amount;

  constructor(min: amount.Amount) {
    super(`Minimum transfer amount is ${amount.display(min)}`);
    this.min = min;
  }

  minAmount(): amount.Amount {
    return this.min;
  }
}

// Special error to return from quote() or validate() when the
// protocol can't provide a quote.
export class UnavailableError extends Error {
  internalError: Error;

  constructor(internalErr: Error) {
    super(`Unable to fetch a quote`);
    this.internalError = internalErr;
  }
}
