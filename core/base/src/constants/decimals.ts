import { toMapping } from "../utils";

const nativeTokenDecimals = [
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

export const NATIVE_DECIMALS = {
  Mainnet: toMapping(nativeTokenDecimals, 0, 1),
  Testnet: toMapping(nativeTokenDecimals, 0, 1),
};
