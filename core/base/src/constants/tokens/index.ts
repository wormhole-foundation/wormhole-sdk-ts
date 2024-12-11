import type { Chain } from "../chains.js";
import type { Network } from "../networks.js";
import type { ChainTokens, Token, TokenKey, TokenSymbol } from "../tokens.js";
import { filters } from "../tokens.js";

import { mainnetChainTokens } from "./mainnet.js";
import { testnetChainTokens } from "./testnet.js";

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

  throw new Error("Unsupported network: " + network);
}

// The token that represents the native gas token on a given chain
// also represented as the string 'native' where applicable
export function getNative<N extends Network, C extends Chain>(
  network: N,
  chain: C,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  return tokenMap ? filters.native(tokenMap) : undefined;
}

// Finds the (first) unique token key for a given chain and address
export function getTokenByAddress<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  address: string,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  return tokenMap ? filters.byAddress(tokenMap, address) : undefined;
}

export function getTokensBySymbol<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  symbol: TokenSymbol,
): Token[] | undefined {
  const tokenMap = getTokenMap(network, chain);
  return tokenMap ? filters.bySymbol(tokenMap, symbol) : undefined;
}

// Finds the (first) unique token key for a given chain and symbol
export function getTokenByKey<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  key: TokenKey,
): Token | undefined {
  const tokenMap = getTokenMap(network, chain);
  return tokenMap ? filters.byKey(tokenMap, key) : undefined;
}

// The Canonical token is the token that the input key resolves to
// from its original chain. For example, if the input key is
// USDCeth, the canonical token is USDC on ETH
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
