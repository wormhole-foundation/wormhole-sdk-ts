import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { AttestationReceipt, TransferReceipt } from "../types";

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

// Quote containing expected details
// of the transfer
export interface Quote {
  sourceToken: {
    token: TokenId;
    amount: string;
  };

  destinationToken: {
    token: TokenId;
    amount: string;
  };
  // If the transfer being quoted is automatic
  // a relayer fee may apply
  relayFee?: {
    token: TokenId;
    amount: string;
  };
  // If the transfer being quoted asked for native gas dropoff
  // this will contain the amount of native gas that is to be minted
  // on the destination chain given the current swap rates
  destinationNativeGas?: string;
}

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
