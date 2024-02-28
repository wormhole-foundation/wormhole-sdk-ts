import {
  Platform,
  Chain,
  Network,
  chainToPlatform,
  isChain,
  tokens,
} from "@wormhole-foundation/sdk-connect";
import axios from "axios";
import fs from "fs";
import * as prettier from "prettier";
import * as ts from "typescript";

const tokenConfigUrl = (network: string) =>
  `https://raw.githubusercontent.com/wormhole-foundation/wormhole-connect/development/wormhole-connect/src/config/${network}/tokens.ts`;

type TokensConfig = { [key: string]: TokenConfig };
type TokenConfig = {
  key: string; // same as the key in TokensConfig
  symbol: string; // unique possibly shorter name (eg key is USDCeth, symbol is USDC)
  nativeChain: string; // the chain that the token is native to
  tokenId?: {
    chain: string; // same as native chain
    address: string;
  }; // if no token id, it is the native token
  coinGeckoId: string;
  color: string;
  decimals: {
    default: number;
  } & {
    [key: string]: number;
  };
  wrappedAsset?: string;
  displayName?: string;
  foreignAssets?: {
    // keyed by connect chain name
    [key: string]: {
      address: string;
      decimals: number;
    };
  };
};

const testnetChainMap: Record<string, Chain> = {
  goerli: "Ethereum",
  mumbai: "Polygon",
  alfajores: "Celo",
  fuji: "Avalanche",
  moonbasealpha: "Moonbeam",
  basegoerli: "Base",
  arbitrumgoerli: "Arbitrum",
  optimismgoerli: "Optimism",
  base_sepolia: "BaseSepolia",
  arbitrum_sepolia: "ArbitrumSepolia",
  optimism_sepolia: "OptimismSepolia",
};

function mapConnectChainToChain(network: Network, chain: string): Chain {
  // first try to just capitalize the chain name, might be enough
  const titleChain = chain.charAt(0).toUpperCase() + chain.slice(1);
  if (isChain(titleChain)) return titleChain;

  switch (network) {
    case "Mainnet":
      throw `${network}:${chain}`;
    case "Testnet":
      if (testnetChainMap[chain]) return testnetChainMap[chain]!;
      throw `${network}:${chain}`;
  }

  throw "Unsupported network: " + network;
}

function platformToConnectPlatform(platform: Platform): string {
  switch (platform) {
    case "Evm":
      return "Ethereum";
    case "Cosmwasm":
      return "Cosmos";
  }
  return platform;
}

// Fetch the tokens config from the connect repo and parse it into a TokensConfig object
async function getNetworkTokensConfig(network: Network): Promise<TokensConfig> {
  // pull in the typescript file containing the token config
  const tsTokenConfig = await axios.get<string>(tokenConfigUrl(network.toLowerCase()));
  // strip the imports and the `icon` field
  const tokenObjStr = tsTokenConfig.data.replace(/import.*\n/g, "").replace(/icon:.*\n/g, "");
  // transpile from ts
  const tokenObjJsStr = ts.transpile(tokenObjStr);
  // eval the typescript file to get the tokens config object
  return eval(tokenObjJsStr);
}

// Token const file
const pathToConst = (network: Network) =>
  `../core/base/src/constants/tokens/${network.toLowerCase()}.ts`;
const tokenListConstTemplate = (network: Network, tokenArr: any[]) => `
import { MapLevel, constMap } from "../../utils";
import { Chain } from "../chains";
import { TokenSymbol, TokenConst } from "./types";

const ${network.toLowerCase()}TokenEntries = ${JSON.stringify(
  tokenArr,
  null,
  2,
)} as const satisfies MapLevel<Chain, MapLevel<TokenSymbol, TokenConst>>;

export const ${network.toLowerCase()}ChainTokens = constMap(${network.toLowerCase()}TokenEntries, [0, [1, 2]]);
`;

// Token details const file
const pathToDetails = (network: Network) =>
  `../core/base/src/constants/tokens/${network.toLowerCase()}Details.ts`;
const tokenDetailsConstTemplate = (network: Network, tokenArr: any[]) => `
import { MapLevel, constMap } from "../../utils";
import { TokenSymbol, TokenExtraDetails } from "./types";

const ${network.toLowerCase()}Tokens = ${JSON.stringify(
  tokenArr,
  null,
  2,
)} as const satisfies MapLevel<TokenSymbol, TokenExtraDetails>;

export const ${network.toLowerCase()}TokenDetails = constMap(${network.toLowerCase()}Tokens);

`;

type TokensByChain = { [chain in Chain]?: tokens.Token[] };
type Deets = Record<string, tokens.TokenExtraDetails>;
async function fetchAndRemapConnectTokens(network: Network): Promise<[any, any]> {
  const tc: TokensConfig = await getNetworkTokensConfig(network);

  const reg: TokensByChain = {};
  const deets: Deets = {};

  for (const key in tc) {
    const token = tc[key]!;

    const { tokenId, wrappedAsset, nativeChain: _nativeChain, foreignAssets, decimals } = token;
    const nativeChain = mapConnectChainToChain(network, _nativeChain);

    deets[key] = makeTokenDetails(network, token);

    reg[nativeChain] = reg[nativeChain] ?? [];

    const platform = platformToConnectPlatform(chainToPlatform(nativeChain));

    const _decimals = platform in decimals ? decimals[platform] : decimals.default;

    const wrappedKey = tokenId ? undefined : wrappedAsset!;

    const address = tokenId ? tokenId.address : "native";
    const tokenEntry = {
      key: key,
      symbol: token.symbol,
      decimals: _decimals!,
      address: address,
      chain: nativeChain,
      wrappedKey,
    };

    reg[nativeChain]!.push(tokenEntry);

    for (const _chain in foreignAssets) {
      const chain = mapConnectChainToChain(network, _chain);

      const _token = foreignAssets[_chain]!;

      reg[chain] = reg[chain] ?? [];
      reg[chain]!.push({
        key: key,
        chain,
        symbol: token.symbol,
        decimals: _token.decimals,
        address: _token.address,
        original: nativeChain,
      });
    }
  }

  return [flattenRegistry(reg), flattenDeets(deets)];
}

function makeTokenDetails(network: Network, token: TokenConfig): tokens.TokenExtraDetails {
  const { key, symbol, displayName, nativeChain: _nativeChain, coinGeckoId } = token;
  const nativeChain = mapConnectChainToChain(network, _nativeChain);
  return { key, symbol, displayName, coinGeckoId, nativeChain };
}

function flattenRegistry(registry: TokensByChain) {
  return Object.entries(registry).map(([_chain, reg]) => {
    const tokenMap = reg.map((_token) => {
      const { key } = _token;
      // @ts-ignore
      delete _token.key;
      // @ts-ignore
      delete _token.chain;
      return [key, _token];
    });
    return [_chain, tokenMap];
  });
}

function flattenDeets(deets: Deets) {
  return Object.entries(deets).map(([_key, reg]) => [_key, reg]);
}

(async function () {
  await importTokens("Testnet");
  await importTokens("Mainnet");
})();

async function importTokens(network: Network) {
  const [registry, details] = await fetchAndRemapConnectTokens(network);

  const tokenListFile = tokenListConstTemplate(network, registry);
  const formattedFile = await prettier.format(tokenListFile, { parser: "typescript" });
  fs.writeFileSync(pathToConst(network), formattedFile);

  const tokenDetailsFile = tokenDetailsConstTemplate(network, details);
  const formattedDetailsFile = await prettier.format(tokenDetailsFile, { parser: "typescript" });
  fs.writeFileSync(pathToDetails(network), formattedDetailsFile);
}
