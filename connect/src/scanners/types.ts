import type { amount } from "@wormhole-foundation/sdk-base";
import type { Chain } from "@wormhole-foundation/sdk-base";
import type { TokenId } from "@wormhole-foundation/sdk-definitions";

type TODO = any;

// Transaction history single entry description
// TODO: add more data related to transactions
// TODO: figure out if we need to support custom fields
export interface TransactionData {
  hash: string;
  routeName: string;
  status: TODO;

  source: {
    chain: Chain;
    token: TokenId;
    amount: amount.Amount;
    timestamp: number;
  };

  destination: {
    chain: Chain;
    token: TokenId;
    amount: amount.Amount;
    timestamp: number;
  };
}

// Successful transaction history fetch results
export interface TransactionHistory {
  success: true;
  fetchNext: TODO;

  // TODO: figure out if we can get those
  moreAvailable: boolean;
  totalCount: number;

  transactions: TransactionData[];
}

// Transaction history fetch error structure
export interface ScannerError {
  success: false;
  error: Error;
}

export type ScannerResult = TransactionHistory | ScannerError;

export abstract class Scanner<TScannerParams = {}> {
  // Fetches transaction by specified address
  public abstract getTransactions(params: TScannerParams): Promise<ScannerResult>;
}
