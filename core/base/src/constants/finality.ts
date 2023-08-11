import { Network } from "./networks";
import { ChainName } from "./chains";
import { toMapping, toMappingFunc } from "../utils";

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
  [
    "Testnet",
    [
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
    ],
  ],
  ["Devnet", []],
] as const satisfies readonly (readonly [
  Network,
  readonly (readonly [ChainName, number])[]
])[];

// TODO: recursive toMapping
const mapping = {
  Mainnet: toMapping(finalityThresholds[0][1]),
  Testnet: toMapping(finalityThresholds[1][1]),
  Devnet: toMapping(finalityThresholds[2][1]),
} as const;

export const finalityThreshold = toMappingFunc(mapping);
