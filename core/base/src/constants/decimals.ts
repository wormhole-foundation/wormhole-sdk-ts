import type { MapLevel} from "../utils";
import { constMap } from "../utils";
import type { Platform } from "./platforms";

// prettier-ignore
const nativeDecimalEntries = [
  ["Evm",     18],
  ["Solana",   9],
  ["Sui",      9],
  ["Aptos",    8],
  ["Cosmwasm", 6],
  ["Algorand", 6],
  ["Btc",      8],
  ["Near",    12],
] as const satisfies MapLevel<Platform, number>;

/** Number of decimals for the native token on a given platform */
export const nativeDecimals = constMap(nativeDecimalEntries);
