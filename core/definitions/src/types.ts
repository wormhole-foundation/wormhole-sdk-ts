import {
  ChainName,
  ExplorerSettings,
  PlatformName,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress } from "./address";
import { Contracts } from "./contracts";

export type TxHash = string;
export type SequenceId = bigint;

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

export type ChainConfig = {
  key: ChainName;
  platform: PlatformName;
  contracts: Contracts;
  finalityThreshold: number;
  nativeTokenDecimals: number;
  explorer: ExplorerSettings;
  rpc: string;
};

export type ChainsConfig = {
  [K in ChainName]?: ChainConfig;
};
