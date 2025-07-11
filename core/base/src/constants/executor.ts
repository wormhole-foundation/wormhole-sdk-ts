import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Network } from "./networks.js";

const executorAPIs = [
  ["Mainnet", "https://executor.labsapis.com/v0"],
  ["Testnet", "https://executor-testnet.labsapis.com/v0"],
] as const satisfies MapLevel<Network, string>;

export const executorAPI = constMap(executorAPIs);
