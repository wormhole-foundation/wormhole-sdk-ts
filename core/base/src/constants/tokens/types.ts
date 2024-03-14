import type { Chain } from '../chains.js';

// unique name to key off
export type TokenKey = string;
// common symbol for token
export type TokenSymbol = string;

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
