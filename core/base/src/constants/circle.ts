import type { Column, Flatten, MapLevel } from "./../utils/index.js";
import { constMap, zip } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";

const circleAPIs = [
  ["Mainnet", "https://iris-api.circle.com/v1/attestations"],
  ["Testnet", "https://iris-api-sandbox.circle.com/v1/attestations"],
] as const satisfies MapLevel<Network, string>;
export const circleAPI = constMap(circleAPIs);

// prettier-ignore
const usdcContracts = [[
  "Mainnet", [
    ["Ethereum",  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    ["Avalanche", "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"],
    ["Optimism",  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"],
    ["Arbitrum",  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"],
    ["Solana",    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
    ["Base",      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"],
    ["Polygon",   "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"],
    ["Sui",       "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"],
  ]], [
  "Testnet", [
    ["Sepolia",         "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"],
    ["Avalanche",       "0x5425890298aed601595a70AB815c96711a31Bc65"],
    ["OptimismSepolia", "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"],
    ["ArbitrumSepolia", "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"],
    ["Solana",          "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"],
    ["BaseSepolia",     "0x036CbD53842c5426634e7929541eC2318f3dCF7e"],
    ["Polygon",         "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97"],
    ["Sui",             "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC"],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;
export const usdcContract = constMap(usdcContracts);

// prettier-ignore
// https://developers.circle.com/stablecoin/docs/cctp-technical-reference#domain-list
const circleDomains = [[
  "Mainnet", [
    ["Ethereum",  0],
    ["Avalanche", 1],
    ["Optimism",  2],
    ["Arbitrum",  3],
    ["Solana",    5],
    ["Base",      6],
    ["Polygon",   7],
    ["Sui",       8],
  ]], [
  "Testnet", [
    ["Sepolia",         0],
    ["Avalanche",       1],
    ["OptimismSepolia", 2],
    ["ArbitrumSepolia", 3],
    ["Solana",          5],
    ["BaseSepolia",     6],
    ["Polygon",         7],
    ["Sui",             8],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, number>>;

export const circleChainId = constMap(circleDomains, [[0, 1], 2]);
export const circleChainIdToChain = constMap(circleDomains, [[0, 2], 1]);

export const [circleNetworks, circleChainMap] = zip(circleDomains);
export type CircleNetwork = (typeof circleNetworks)[number];

export type CircleChain = Column<Flatten<typeof circleChainMap>, 0>[number];
export type CircleChainId = Column<Flatten<typeof circleChainMap>, 1>[number];

export const isCircleChain = (network: Network, chain: string): chain is CircleChain =>
  circleChainId.has(network, chain);
export const isCircleChainId = (network: Network, chainId: number): chainId is CircleChainId =>
  circleChainIdToChain.has(network, chainId);
export const isCircleSupported = (network: Network, chain: string): network is CircleNetwork =>
  usdcContract.has(network, chain);

export function assertCircleChainId(
  network: Network,
  chainId: number,
): asserts chainId is CircleChainId {
  if (!isCircleChainId(network, chainId)) throw Error(`Unknown Circle chain id: ${chainId}`);
}
export function assertCircleChain(network: Network, chain: string): asserts chain is CircleChain {
  if (!isCircleChain(network, chain)) throw Error(`Unknown Circle chain: ${chain}`);
}

//safe assertion that allows chaining
export const asCircleChainId = (network: Network, chainId: number): CircleChainId => {
  assertCircleChainId(network, chainId);
  return chainId;
};

export const toCircleChainId = (
  network: Network,
  chain: number | bigint | string,
): CircleChainId => {
  switch (typeof chain) {
    case "string":
      if (isCircleChain(network, chain)) return circleChainId.get(network, chain)!;
      break;
    case "number":
      if (isCircleChainId(network, chain)) return chain;
      break;
    case "bigint":
      const ci = Number(chain);
      if (isCircleChainId(network, ci)) return ci;
      break;
  }
  throw Error(`Cannot convert to ChainId: ${chain}`);
};

export const toCircleChain = (network: Network, chain: number | string | bigint): CircleChain => {
  switch (typeof chain) {
    case "string":
      if (isCircleChain(network, chain)) return chain;
      break;
    case "number":
      if (isCircleChainId(network, chain))
        return circleChainIdToChain(network as CircleNetwork, chain);
      break;
    case "bigint":
      const cid = Number(chain);
      if (isCircleChainId(network, cid)) return circleChainIdToChain(network as CircleNetwork, cid);
      break;
  }
  throw Error(`Cannot convert to Chain: ${chain}`);
};
