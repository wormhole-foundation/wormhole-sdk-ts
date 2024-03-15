import type { MapLevel} from './../utils/index.js';
import { constMap } from './../utils/index.js';
import type { Platform } from './platforms.js';

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
