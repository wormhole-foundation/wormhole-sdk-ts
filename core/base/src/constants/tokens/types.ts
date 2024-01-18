import { Chain } from "../chains";

export type TokenSymbol = string;

export type ChainTokens = {
  [symbol: TokenSymbol]: Token;
};

export type Token = {
  decimals: number;
  address: string | "native";
  symbol?: TokenSymbol;
  // Set if this is a wrapped token
  // represents original token on its native chain
  original?: {
    chain: Chain;
    address: string;
    decimals: number;
  };
  // Set if this is a native gas token
  // or a token that should be wrapped before bridging
  // represents the wrapped token on its native chain
  wrapped?: {
    address: string;
    decimals: number;
  };
};

export type TokenDetails = {
  key: string;
  symbol: TokenSymbol;
  nativeChain: Chain;
  coinGeckoId: string;
  displayName?: string;
};
