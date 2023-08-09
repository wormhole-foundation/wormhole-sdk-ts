import { UnsignedTransaction } from "./unsignedTransaction";

// Primary interface to pass for signing transactions
export interface Signer {
  sign(transaction: UnsignedTransaction): any;
}
