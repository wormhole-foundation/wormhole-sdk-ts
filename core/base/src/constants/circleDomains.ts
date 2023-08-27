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

export const isCircleChain = (chain: string): chain is CircleChainName =>
  circleChainId.has(chain);
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
