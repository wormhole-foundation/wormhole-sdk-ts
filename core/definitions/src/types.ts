import { ChainName } from "@wormhole-foundation/sdk-base";
import { ChainAddress } from "./address";

export type TxHash = string;
export type SequenceId = bigint;

// TODO: Provide more details, Genericize?
export type SignedTxn = any;

// Fully qualified Token Id
export type TokenId = ChainAddress;

// Fully qualifier Transaction ID
export type TransactionId = { chain: ChainName; txid: TxHash };
export function isTransactionIdentifier(
  thing: TransactionId | any
): thing is TransactionId {
  return (
    (<TransactionId>thing).chain !== undefined &&
    (<TransactionId>thing).txid !== undefined
  );
}
