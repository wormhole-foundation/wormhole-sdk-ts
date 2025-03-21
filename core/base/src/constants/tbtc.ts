import { constMap, MapLevels } from "../utils/index.js";
import { Chain } from "./chains.js";
import { Network } from "./networks.js";

// Native tokens minted by Threshold
const tbtcToken = [
  [
    "Mainnet",
    [
      ["Ethereum", "0x18084fbA666a33d37592fA2633fD49a74DD93a88"],
      ["Solana", "6DNSN2BJsaPFdFFc1zP37kkeNe4Usc1Sqkzr9C9vPWcU"],
      ["Polygon", "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b"],
      ["Arbitrum", "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40"],
      ["Optimism", "0x6c84a8f1c29108F47a79964b5Fe888D4f4D0dE40"],
      ["Base", "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b"],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, string]>;

export const tbtcTokens = constMap(tbtcToken);
