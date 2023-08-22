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
] as const satisfies readonly (readonly [
  Network,
  readonly (readonly [ChainName, number])[]
])[];

const mapping = {
  Mainnet: toMapping(finalityThresholds[0][1]),
  Testnet: toMapping(finalityThresholds[1][1]),
  // TODO: reusing testnet finality, ok?
  Devnet: toMapping(finalityThresholds[1][1]),
} as const;

export const finalityThreshold = toMappingFunc(mapping) satisfies (
  n: Network
) => {
  readonly [K in ChainName]?: number;
};
