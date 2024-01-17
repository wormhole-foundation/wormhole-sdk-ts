import { Chain } from "../chains";
import { Network } from "../networks";

//import { mainnetTokenDetails } from "./mainnetTokenDetails";
//import { testnetTokenDetails } from "./testnetTokenDetails";

import { mainnetChainTokens, mainnetTokens } from "./mainnet";
import { testnetChainTokens, testnetTokens } from "./testnet";
import { ChainTokens, Token } from "./types";

export * from "./types";

export function getToken<N extends Network, C extends Chain>(
  network: N,
  chain: C,
  symbol: string,
): Token | undefined {
  if (network === "Devnet") return;

  if (network === "Mainnet") {
    if (!mainnetTokens.has(chain, symbol)) return;
    return mainnetTokens.get(chain, symbol);
  }

  if (network === "Testnet") {
    // @ts-ignore
    if (!testnetTokens.has(chain, symbol)) return;
    // @ts-ignore
    return testnetTokens.get(chain, symbol);
  }

  throw "Unsupported network: " + network;
}

export function getTokenMap<N extends Network, C extends Chain>(
  network: N,
  chain: C,
): ChainTokens | undefined {
  if (network === "Devnet") return;

  if (network === "Mainnet") {
    if (!mainnetChainTokens.has(chain)) return;
    const chainTokens = mainnetChainTokens.get(chain);
    return Object.fromEntries(chainTokens!.map(([symbol, token]) => [symbol, token]));
  }

  if (network === "Testnet") {
    if (!testnetChainTokens.has(chain)) return;
    const chainTokens = testnetChainTokens.get(chain);
    return Object.fromEntries(chainTokens!.map(([symbol, token]) => [symbol, token]));
  }

  throw "Unsupported network: " + network;
}
