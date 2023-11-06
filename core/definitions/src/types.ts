import {
  ChainName,
  ExplorerSettings,
  Network,
  PlatformName,
  blockTime,
  chainIds,
  chainToPlatform,
  chains,
  explorerConfigs,
  finalityThreshold,
  isChain,
  nativeDecimals,
  rpcAddress,
  toChainId,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, NativeAddress, toNative } from "./address";
import { Contracts, getContracts } from "./contracts";
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
  // Wormhole Chain Id for this chain
  chainId: number;
  // Contract addresses for this chain
  contracts: Contracts;
  // Number of blocks before a transaction is considered final
  finalityThreshold: number;
  // Average block time in milliseconds
  blockTime: number;
  // Number of decimal places for the native gas token (e.g. 18 for ETH)
  nativeTokenDecimals: bigint;
  // Native chain id may be eip155 or genesis hash or network moninker or something else
  // depending on the platform
  nativeChainId: string;
  rpc: string;
  explorer?: ExplorerSettings;
};

export type ChainsConfig = {
  [K in ChainName]?: ChainConfig;
};

export function buildConfig(n: Network): ChainsConfig {
  const cc: ChainsConfig = chains
    .map((c: ChainName): ChainConfig => {
      const platform = chainToPlatform(c);
      let nativeChainId = "";
      try {
        nativeChainId = chainIds.getNativeChainId(n, c);
      } catch {}
      return {
        key: c,
        platform,
        network: n,
        chainId: toChainId(c),
        finalityThreshold: finalityThreshold.get(n, c) ?? 0,
        blockTime: blockTime(c),
        contracts: getContracts(n, c),
        nativeTokenDecimals: nativeDecimals(platform),
        nativeChainId,
        explorer: explorerConfigs(n, c),
        rpc: rpcAddress(n, c),
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}
