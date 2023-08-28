import { Network } from "./networks";
import { Chain, ChainName } from "./chains";
import { zip, constMap, RoArray } from "../utils";

// https://developers.circle.com/stablecoin/docs/cctp-technical-reference#domain-list
const circleDomains = [
  ["Ethereum", 0],
  ["Avalanche", 1],
  ["Arbitrum", 3],
] as const satisfies RoArray<readonly [ChainName, number]>;

export const [circleChains, circleChainIds] = zip(circleDomains);
export type CircleChainName = (typeof circleChains)[number];
export type CircleChainId = (typeof circleChainIds)[number];

export const circleChainId = constMap(circleDomains);
export const circleChainIdToChainName = constMap(circleDomains, [1, 0]);

const usdcContracts = [
  [
    "Mainnet",
    [
      ["Ethereum", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
      ["Avalanche", "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e"],
      ["Arbitrum", "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"],
    ],
  ],
  [
    "Testnet",
    [
      ["Avalanche", "0x5425890298aed601595a70AB815c96711a31Bc65"],
      ["Ethereum", "0x07865c6e87b9f70255377e024ace6630c1eaa37f"],
      ["Arbitrum", "0x179522635726710dd7d2035a81d856de4aa7836c"],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const usdcContract = constMap(usdcContracts);

const circleAPIs = [
  ["Mainnet", "https://iris-api.circle.com/v1/attestations"],
  ["Testnet", "https://iris-api-sandbox.circle.com/v1/attestations"],
] as const satisfies RoArray<readonly [Network, string]>;

export const circleAPI = constMap(circleAPIs);

export const isCircleChain = (
  chain: string | ChainName | CircleChainName
): chain is CircleChainName => circleChainId.has(chain);
export const isCircleChainId = (chainId: number): chainId is CircleChainId =>
  circleChainIdToChainName.has(chainId);

export function assertCircleChainId(
  chainId: number
): asserts chainId is CircleChainId {
  if (!isCircleChainId(chainId))
    throw Error(`Unknown Circle chain id: ${chainId}`);
}

export function assertCircleChain(
  chain: string
): asserts chain is CircleChainName {
  if (!isCircleChain(chain)) throw Error(`Unknown Circle chain: ${chain}`);
}

//safe assertion that allows chaining
export const asCircleChainId = (chainId: number): CircleChainId => {
  assertCircleChainId(chainId);
  return chainId;
};

export const toCircleChainId = (
  chain: number | bigint | string | Chain
): CircleChainId => {
  switch (typeof chain) {
    case "string":
      if (isCircleChain(chain)) return circleChainId(chain);
      break;
    case "number":
      if (isCircleChainId(chain)) return chain;
      break;
    case "bigint":
      const ci = Number(chain);
      if (isCircleChainId(ci)) return ci;
      break;
  }
  throw Error(`Cannot convert to ChainId: ${chain}`);
};

export const toCircleChainName = (
  chain: number | string | Chain | bigint
): ChainName => {
  switch (typeof chain) {
    case "string":
      if (isCircleChain(chain)) return chain;
      break;
    case "number":
      if (isCircleChainId(chain)) return circleChainIdToChainName(chain);
      break;
    case "bigint":
      const cid = Number(chain);
      if (isCircleChainId(cid)) return circleChainIdToChainName(cid);
      break;
  }
  throw Error(`Cannot convert to ChainName: ${chain}`);
};
