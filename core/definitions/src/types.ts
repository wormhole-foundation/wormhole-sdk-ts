import { ChainName } from "@wormhole-foundation/sdk-base";
import { ChainAddress } from "./address";

export type TxHash = string;
export type SequenceId = bigint;

// TODO: Provide more details, Genericize?
export type SignedTxn = any;

// Fully qualified Token Id
export type TokenId = ChainAddress;

// Wrapped tokens have an original and wrapped version
// original is the source chain
// wrapped is _an_ instance of that token on a given foreign chain
export type WrappedTokenId = {
  original: TokenId;
  wrapped: TokenId;
};

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
