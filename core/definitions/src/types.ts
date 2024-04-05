import type {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
} from "@wormhole-foundation/sdk-base";
import {
  chainToPlatform,
  chains,
  decimals,
  explorer,
  finality,
  isChain,
  nativeChainIds,
  rpc,
  toChainId,
} from "@wormhole-foundation/sdk-base";

import type { ChainTokens, Token } from "@wormhole-foundation/sdk-base";
import { getNative, getTokenByKey, getTokenMap } from "@wormhole-foundation/sdk-base/tokens";
import type { ChainAddress, UniversalOrNative } from "./address.js";
import { toNative } from "./address.js";
import type { Contracts } from "./contracts.js";
import { getContracts } from "./contracts.js";

/** Alias for string, used to look up transaction details */
export type TxHash = string;
/** The sequence number assigned to a given message by the core bridge */
export type SequenceId = bigint;
/** A signed transaction in its canonical format */
export type SignedTx = any;

/**
 * An address representing an asset
 * @remarks the string literal 'native' is used to represent the native gas token
 */
export type TokenAddress<C extends Chain> = UniversalOrNative<C> | "native";

// Typeguard to check if the token address is the string "native" representing the gas token
// on a given chain
export function isNative(thing: any): thing is "native" {
  return typeof thing === "string" && thing === "native";
}

/**  Utility to create a TokenId with the address set to the string "native" */
export function nativeTokenId<C extends Chain>(chain: C): TokenId<C> {
  return { chain, address: "native" };
}

/**
 * A TokenId is a unique identifier for a token on a given chain
 *
 * @interface TokenId
 */
export type TokenId<C extends Chain = Chain> = { chain: C; address: TokenAddress<C> };
export function isTokenId<C extends Chain>(thing: any): thing is TokenId<C> {
  return (
    typeof thing === "object" &&
    (<TokenId<C>>thing).address !== undefined &&
    (<TokenId<C>>thing).chain !== undefined &&
    isChain((<TokenId<C>>thing).chain)
  );
}

export function isSameToken(a: TokenId, b: TokenId): boolean {
  if (a.chain !== b.chain) return false;
  if (isNative(a.address) && isNative(b.address)) return true;
  return canonicalAddress(a) === canonicalAddress(b);
}

/** Utility function to return the string representation of a ChainAddress or TokenId */
export function canonicalAddress(ca: ChainAddress | TokenId): string {
  if (isTokenId(ca) && isNative(ca.address)) return ca.address;
  // @ts-ignore
  return ca.address.toNative(ca.chain).toString();
}

export function universalAddress(ca: ChainAddress | TokenId): string {
  if (isNative(ca.address))
    throw new Error(
      "Invalid address, cannot convert the string literal `native` to a Universal Address",
    );
  return ca.address.toUniversalAddress().toString();
}

/**
 * Given a token id, address, or the const string 'native' return
 * a TokenId representing either the token itself or the wrapped version
 */
export function resolveWrappedToken<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  token: TokenId<C> | TokenAddress<C>,
): [boolean, TokenId<C>] {
  let tokenAddr: TokenAddress<C>;

  if (isTokenId(token)) {
    if (!isNative(token.address)) return [false, token];
    tokenAddr = token.address;
  } else {
    tokenAddr = token;
  }

  if (isNative(tokenAddr)) {
    const nativeToken = getNative(network, chain);
    if (!nativeToken) throw new Error("Invalid destination token");

    const wrappedKey = nativeToken.wrappedKey!;
    const wrappedToken = getTokenByKey(network, chain, wrappedKey);
    if (!wrappedToken) throw new Error("Invalid wrapped token key: " + wrappedKey);
    const destNativeWrapped = { chain, address: toNative(chain, wrappedToken.address) };

    return [true, destNativeWrapped];
  }

  const tid: TokenId<C> = { chain, address: tokenAddr };

  return [false, tid];
}

export type Balances = {
  [key: string]: bigint | null;
};

/**  Fully qualified Transaction ID */
export type TransactionId<C extends Chain = Chain> = { chain: C; txid: TxHash };
export function isTransactionIdentifier(thing: TransactionId | any): thing is TransactionId {
  return (<TransactionId>thing).chain !== undefined && (<TransactionId>thing).txid !== undefined;
}

/** Configuration for a given Chain */
export type ChainConfig<N extends Network, C extends Chain> = {
  key: C;
  network: N;
  platform: ChainToPlatform<C>;
  /** Wormhole Chain Id for this chain */
  chainId: number;
  /** Contract addresses for this chain */
  contracts: Contracts;
  /** Number of blocks before a transaction is considered final */
  finalityThreshold: number;
  /** Average block time in milliseconds */
  blockTime: number;
  /** Number of decimal places for the native gas token (e.g. 18 for ETH) */
  nativeTokenDecimals: number;
  /**
   * Native chain id may be eip155 or genesis hash or network moninker or something else
   * depending on the platform
   */
  nativeChainId: string | bigint;
  /**
   * Rpc address for this chain
   */
  rpc: string;
  tokenMap?: ChainTokens;
  wrappedNative?: Token;
  explorer?: explorer.ExplorerSettings;
};

export type ChainsConfig<N extends Network, P extends Platform> = {
  [K in PlatformToChains<P>]?: ChainConfig<N, K>;
};

export function buildConfig<N extends Network>(n: N): ChainsConfig<N, Platform> {
  const cc: ChainsConfig<N, Platform> = chains
    .map(<C extends Chain>(c: C): ChainConfig<N, C> => {
      const platform = chainToPlatform(c);
      let nativeChainId: bigint | string = "";
      try {
        nativeChainId = nativeChainIds.networkChainToNativeChainId.get(n, c)!;
      } catch {}
      const tokenMap = getTokenMap(n, c);

      const nativeToken = tokenMap
        ? Object.values(tokenMap).find((token) => isNative(token.address) && token.wrappedKey)
        : undefined;

      const wrappedNative = nativeToken ? tokenMap![nativeToken.wrappedKey!] : undefined;

      return {
        key: c,
        platform,
        network: n,
        chainId: toChainId(c),
        finalityThreshold: finality.finalityThreshold.get(c) ?? 0,
        blockTime: finality.blockTime.get(c) ?? 0,
        contracts: getContracts(n, c),
        nativeTokenDecimals: decimals.nativeDecimals(platform),
        nativeChainId,
        tokenMap,
        wrappedNative,
        explorer: explorer.explorerConfigs(n, c),
        rpc: rpc.rpcAddress(n, c),
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}
