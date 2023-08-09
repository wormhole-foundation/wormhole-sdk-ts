import { MAINNET, TESTNET } from "./networks";
import { toMapping } from "../utils";

const finalityThresholds = [
  [
    MAINNET,
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
  [
    TESTNET,
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
] as const;

// TODO: recursive toMapping
export const FINALITY_THRESHOLDS = {
  Mainnet: toMapping(finalityThresholds[0][1], 0, 1),
  Testnet: toMapping(finalityThresholds[1][1], 0, 1),
};
