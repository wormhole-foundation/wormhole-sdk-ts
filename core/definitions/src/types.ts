import {
  ChainName,
  ExplorerSettings,
  PlatformName,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, toNative } from "./address";
import { Contracts } from "./contracts";
import { UnsignedTransaction } from "./unsignedTransaction";

export type TxHash = string;
export type SequenceId = bigint;

export type SignedTx = any;

// Fully qualified Token Id
export type TokenId = ChainAddress;

export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: UnsignedTransaction[]): Promise<SignedTx[]>;
}

export function isSigner(thing: Signer | any): thing is Signer {
  return (
    typeof (<Signer>thing).chain === "function" &&
    typeof (<Signer>thing).address == "function" &&
    typeof (<Signer>thing).sign === "function"
  );
}

export function nativeChainAddress(s: Signer | TokenId): TokenId {
  if (isSigner(s))
    return {
      chain: s.chain(),
      address: toNative(s.chain(), s.address()),
    };

  return {
    chain: s.chain,
    address: s.address.toNative(s.chain),
  };
}

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
