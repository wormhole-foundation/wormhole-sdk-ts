import { Network } from "./networks";
import { ChainName } from "./chains";
import { constMap, RoArray } from "../utils";

const shareFinalities = [
  ["Ethereum", 64],
  ["Solana", 32],
  ["Polygon", 64],
  ["Bsc", 15],
  ["Avalanche", 1],
  ["Fantom", 1],
  ["Celo", 1],
  ["Moonbeam", 1],
  ["Sui", 0],
  ["Aptos", 0],
  ["Sei", 0],
] as const;

const finalityThresholds = [
  [
    "Mainnet",
    [
      ["Ethereum", 64],
      ["Solana", 32],
      ["Polygon", 512],
      ["Bsc", 15],
      ["Avalanche", 1],
      ["Fantom", 1],
      ["Celo", 1],
      ["Moonbeam", 1],
      ["Sui", 0],
      ["Aptos", 0],
      ["Sei", 0],
    ],
  ],
  ["Testnet", shareFinalities],
  ["Devnet", shareFinalities],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, number]>]
>;

export const finalityThreshold = constMap(finalityThresholds);
