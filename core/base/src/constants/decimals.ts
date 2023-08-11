import { toMapping, toMappingFunc } from "../utils";

const nativeDecimalEntries = [
  ["Ethereum", 18],
  ["Solana", 9],
  ["Polygon", 18],
  ["Bsc", 18],
  ["Avalanche", 18],
  ["Fantom", 18],
  ["Celo", 18],
  ["Moonbeam", 18],
  ["Sui", 9],
  ["Aptos", 8],
  ["Sei", 6],
] as const;

const mapping = toMapping(nativeDecimalEntries);
export const nativeDecimals = toMappingFunc(mapping);
