import { Chain } from "../chains";
import { Network } from "../networks";

//import { mainnetTokenDetails } from "./mainnetTokenDetails";
//import { testnetTokenDetails } from "./testnetTokenDetails";

import { mainnetChainTokens } from "./mainnet";
import { testnetChainTokens } from "./testnet";
import { TokenSymbol, TokenKey, ChainTokens, Token } from "./types";

export * from "./types";

export function getTokenMap<N extends Network, C extends Chain>(
  network: N,
  chain: C,
): ChainTokens | undefined {
  if (network === "Devnet") return;

  if (network === "Mainnet") {
    if (!mainnetChainTokens.has(chain)) return;
    const chainTokens = mainnetChainTokens.get(chain);
    return Object.fromEntries(chainTokens!.map(([key, token]) => [key, { ...token, chain, key }]));
  }

  if (network === "Testnet") {
    if (!testnetChainTokens.has(chain)) return;
    const chainTokens = testnetChainTokens.get(chain);
    return Object.fromEntries(chainTokens!.map(([key, token]) => [key, { ...token, chain, key }]));
  }

  throw "Unsupported network: " + network;
}

export const isEqualCaseInsensitive = (a: string, b: string): boolean => {
  return a.toLowerCase() === b.toLowerCase();
};

export function getTokensBySymbol<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  symbol: TokenSymbol,
): Token[] | undefined {
  const tokenMap = getTokenMap(network, chain);
  if (!tokenMap) return;
  const foundTokens = Object.entries(tokenMap)
    .filter(([_, token]) => token.symbol === symbol)
    .map((t) => t[1]);
  if (!foundTokens || foundTokens.length === 0) return;
  return foundTokens;
}

export function getTokenByKey<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  key: TokenKey,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  if (!tokenMap) return;
  const foundToken = Object.entries(tokenMap).find(([_key]) => key === _key);
  if (!foundToken) return;
  return foundToken[1];
}

export function getNativeToken<N extends Network, C extends Chain>(
  network: N,
  chain: C,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  if (!tokenMap) return;
  const nativeTokenEntry = Object.entries(tokenMap).find(([, token]) => token.address === "native");
  if (!nativeTokenEntry) return;
  return nativeTokenEntry[1];
}

export function getCanonicalToken<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  key: TokenKey,
): Token | undefined {
  const token = getTokenByKey(network, chain, key);
  if (!token) return;
  if (!token.original) return token;

  const original = getTokensBySymbol(network, token.original, token.symbol);
  if (!original) return;

  // return the the token with this symbol where no `original` field exists
  return original.find((t) => !t.original);
}

// Finds the unique token key for a given chain and address
export function getTokenByAddress<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  address: string,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  if (!tokenMap) return;
  const foundToken = Object.entries(tokenMap).find(([, token]) =>
    isEqualCaseInsensitive(token.address, address),
  );
  if (!foundToken) return;
  return foundToken[1];
}
