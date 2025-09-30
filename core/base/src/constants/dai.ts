import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";

// prettier-ignore
const daiContracts = [[
  "Mainnet", [
      // Officially supported by https://github.com/sky-ecosystem/developerguides/blob/master/dai/dai-token/dai-token.md#addresses + Wormhole sdk
      ["Ethereum", "0x6B175474E89094C44Da98b954EedeAC495271d0F"],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const daiContract = constMap(daiContracts);
