import {
  ChainName,
  ExplorerSettings,
  Network,
  PlatformName,
  isChain,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, NativeAddress, toNative } from "./address";
import { Contracts } from "./contracts";
import { Signer, isSigner } from "./signer";

import { UniversalAddress } from "./universalAddress";

export type TxHash = string;
export type SequenceId = bigint;

export type SignedTx = any;

export type AnyAddress =
  | NativeAddress<PlatformName>
  | UniversalAddress
  | string
  | number
  | Uint8Array
  | number[];

export type TokenId = ChainAddress;
export function isTokenId(thing: TokenId | any): thing is TokenId {
  return typeof (<TokenId>thing).address !== undefined && isChain((<TokenId>thing).chain);
}

export type Balances = {
  [key: string]: BigInt | null;
};

export function nativeChainAddress(
  s: Signer | TokenId | [ChainName, UniversalAddress | Uint8Array | string],
): ChainAddress {
  if (Array.isArray(s)) {
    // We might be passed a universal address as a string
    // First try to decode it as native, otherwise try
    // to decode it as universal and convert it to native
    let address: NativeAddress<(typeof s)[0]>;
    try {
      address = toNative(s[0], s[1]);
    } catch {
      address =
        s[1] instanceof UniversalAddress
          ? s[1].toNative(s[0])
          : new UniversalAddress(s[1]).toNative(s[0]);
    }
    return {
      chain: s[0],
      address: address,
    };
  }

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
export function isTransactionIdentifier(thing: TransactionId | any): thing is TransactionId {
  return (<TransactionId>thing).chain !== undefined && (<TransactionId>thing).txid !== undefined;
}

// Configuration for a given Chain
export type ChainConfig = {
  key: ChainName;
  network: Network;
  platform: PlatformName;
  contracts: Contracts;
  // Number of blocks before a transaction is considered final
  finalityThreshold: number;
  // Average block time in milliseconds
  blockTime: number;
  nativeTokenDecimals: bigint;
  explorer?: ExplorerSettings;
  rpc: string;
};

export type ChainsConfig = {
  [K in ChainName]?: ChainConfig;
};
