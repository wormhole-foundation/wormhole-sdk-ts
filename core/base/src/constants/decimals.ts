import { constMap } from "../utils";
import { PlatformName } from "./platforms";

const nativeDecimalEntries = [
  ["Evm", 18],
  ["Solana", 9],
  ["Sui", 9],
  ["Aptos", 8],
  ["Cosmwasm", 6],
  ["Algorand", 6],
  ["Btc", 8],
  ["Near", 12],
] as const satisfies readonly (readonly [PlatformName, number])[];

export const nativeDecimals = constMap(nativeDecimalEntries);
