import { constMap, MapLevels } from "../utils/index.js";
import { Chain } from "./chains.js";
import { Network } from "./networks.js";

// tokens minted by Threshold
const tbtcToken = [
  [
    "Mainnet",
    [
      ["Ethereum", ""],
      ["Solana", ""],
      ["Polygon", ""],
      ["Arbitrum", ""],
      ["Optimism", ""],
      ["Base", ""],
    ],
  ],
  [
    "Testnet",
    [
      ["Sepolia", ""],
      ["Solana", ""],
      ["ArbitrumSepolia", ""],
      ["OptimismSepolia", ""],
      ["BaseSepolia", ""],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, string]>;

export const tbtcTokens = constMap(tbtcToken);
