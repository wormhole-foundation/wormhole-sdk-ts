import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";

// prettier-ignore
const usdsContracts = [[
  "Mainnet", [
      // Officially supported by https://developers.sky.money/protocol/tokens/susds
      ["Ethereum", "0xdC035D45d973E3EC169d2276DDab16f1e407384F"],
      ["Solana", "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA"],
      ["Base", "0x820C137fa70C8691f0e44Dc420a5e53c168921Dc"],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const usdsContract = constMap(usdsContracts);
