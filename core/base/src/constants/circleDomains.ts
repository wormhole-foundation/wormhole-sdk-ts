import { Network } from "./networks";
import { ChainName } from "./chains";
import { constMap, RoArray } from "../utils";

// https://developers.circle.com/stablecoin/docs/cctp-technical-reference#domain-list
const commonCircleDomains = [
  ["Ethereum", 0n],
  ["Avalanche", 1n],
  ["Arbitrum", 3n],
] as const;

const circleDomains = [
  ["Mainnet", commonCircleDomains],
  ["Testnet", commonCircleDomains],
  ["Devnet", commonCircleDomains],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, bigint]>]
>;

export const circleDomain = constMap(circleDomains);
