import type { Chain } from "./chains.js";

// unique name to key off
export type TokenKey = string;
// common symbol for token
export type TokenSymbol = string;

// A map of tokens for a given chain
export type ChainTokens = {
  [symbol: TokenKey]: Token;
};

export type Token = {
  key: TokenKey;
  decimals: number;
  address: string;
  chain: Chain;
  // Common symbol/ticker
  symbol: TokenSymbol;
  // Set if this is a wrapped token
  // represents the original chain where this
  // token originated
  original?: Chain;
  // Set if this is a native gas token
  // or a token that should be wrapped before bridging
  // represents the wrapped token on its native chain
  wrappedKey?: TokenKey;
};

export type TokenConst = Omit<Token, "chain" | "key">;

export type TokenExtraDetails = {
  key: string;
  symbol: TokenSymbol;
  nativeChain: Chain;
  coinGeckoId: string;
  displayName?: string;
};

export const filters = {
  byAddress: (tokenMap: ChainTokens, address: string) => {
    return Object.values(tokenMap).find((token) => isEqualCaseInsensitive(token.address, address));
  },
  native: (tokenMap: ChainTokens) => {
    return filters.byAddress(tokenMap, "native");
  },
  bySymbol: (tokenMap: ChainTokens, symbol: TokenSymbol) => {
    const foundTokens = Object.values(tokenMap).filter((token) => token.symbol === symbol);
    return foundTokens && foundTokens.length > 0 ? foundTokens : undefined;
  },
  byKey: (tokenMap: ChainTokens, key: TokenKey) => {
    const foundToken = Object.entries(tokenMap).find(([_key]) => key === _key);
    return foundToken ? foundToken[1] : undefined;
  },
};

export const isEqualCaseInsensitive = (a: string, b: string): boolean => {
  return a.toLowerCase() === b.toLowerCase();
};
