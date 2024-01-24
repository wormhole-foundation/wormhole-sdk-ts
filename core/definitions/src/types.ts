import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
  chainToPlatform,
  chains,
  decimals,
  explorer,
  finality,
  isChain,
  nativeChainIds,
  rpc,
  toChainId,
  tokens,
} from "@wormhole-foundation/sdk-base";
import { ChainAddress, UniversalOrNative, toNative } from "./address";
import { Contracts, getContracts } from "./contracts";

export type TxHash = string;
export type SequenceId = bigint;
export type SignedTx = any;

export type TokenAddress<C extends Chain> = UniversalOrNative<C> | "native";
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
  if (a.address === "native" && b.address === "native") return true;
  return canonicalAddress(a) === canonicalAddress(b);
}

export function canonicalAddress(ca: ChainAddress | TokenId): string {
  if (isTokenId(ca) && ca.address === "native") return "native";
  // @ts-ignore -- `toNative` will eval to 'never' until platforms are registered
  return ca.address.toNative(ca.chain).toString();
}

// Given a token id, address, or the const string 'native' return
// a TokenId representing either the token itself or the wrapped version
export function resolveWrappedToken<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  token: TokenId<C> | TokenAddress<C>,
): [boolean, TokenId<C>] {
  let tokenAddr: TokenAddress<C>;

  if (isTokenId(token)) {
    if (token.address !== "native") {
      return [false, token];
    }
    tokenAddr = token.address;
  } else {
    tokenAddr = token;
  }

  if (tokenAddr === "native") {
    const nativeToken = tokens.getNative(network, chain);
    if (!nativeToken) throw new Error("Invalid destination token");

    const wrappedKey = nativeToken.wrapped!;
    const wrappedToken = tokens.getTokenByKey(network, chain, wrappedKey.symbol);
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

// Fully qualifier Transaction ID
export type TransactionId<C extends Chain = Chain> = { chain: C; txid: TxHash };
export function isTransactionIdentifier(thing: TransactionId | any): thing is TransactionId {
  return (<TransactionId>thing).chain !== undefined && (<TransactionId>thing).txid !== undefined;
}

// Configuration for a given Chain
export type ChainConfig<N extends Network, C extends Chain> = {
  key: C;
  network: N;
  platform: ChainToPlatform<C>;
  // Wormhole Chain Id for this chain
  chainId: number;
  // Contract addresses for this chain
  contracts: Contracts;
  // Number of blocks before a transaction is considered final
  finalityThreshold: number;
  // Average block time in milliseconds
  blockTime: number;
  // Number of decimal places for the native gas token (e.g. 18 for ETH)
  nativeTokenDecimals: number;
  // Native chain id may be eip155 or genesis hash or network moninker or something else
  // depending on the platform
  nativeChainId: string | bigint;
  rpc: string;
  tokenMap?: tokens.ChainTokens;
  wrappedNative?: tokens.Token;
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
      const tokenMap = tokens.getTokenMap(n, c);

      const nativeToken = tokenMap
        ? Object.values(tokenMap).find((token) => token.address === "native" && token.wrapped)
        : undefined;

      const wrappedNative = nativeToken ? tokenMap![nativeToken.wrapped!.symbol] : undefined;

      return {
        key: c,
        platform,
        network: n,
        chainId: toChainId(c),
        finalityThreshold: finality.finalityThreshold.get(c) ?? 0,
        blockTime: finality.blockTime(c),
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
