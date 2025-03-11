import type { MapLevels } from "./../../utils/index.js";
import type { Chain } from "../chains.js";
import type { Network } from "../networks.js";

export interface TbtcContracts {
  gateway: string; // L2WormholeGateway contract address
  tbtcToken: string; // Tbtc token contract address
}

export const tbtcContracts = [
  [
    "Mainnet",
    [
      ["Solana", { gateway: "87MEvHZCXE3ML5rrmh5uX1FbShHmRXXS32xJDGbQ7h5t", tbtcToken: "" }],
      ["Polygon", { gateway: "0x09959798B95d00a3183d20FaC298E4594E599eab", tbtcToken: "" }],
      ["Arbitrum", { gateway: "0x1293a54e160D1cd7075487898d65266081A15458", tbtcToken: "" }],
      ["Optimism", { gateway: "0x1293a54e160D1cd7075487898d65266081A15458", tbtcToken: "" }],
      ["Base", { gateway: "0x09959798B95d00a3183d20FaC298E4594E599eab", tbtcToken: "" }],
    ],
  ],
  [
    "Testnet",
    [
      ["Solana", { gateway: "87MEvHZCXE3ML5rrmh5uX1FbShHmRXXS32xJDGbQ7h5t", tbtcToken: "" }],
      ["ArbitrumSepolia", { gateway: "0xc3D46e0266d95215589DE639cC4E93b79f88fc6C", tbtcToken: "" }],
      ["OptimismSepolia", { gateway: "0x5FB63D9e076a314023F2D1aB5dBFd7045C281EbA", tbtcToken: "" }],
      ["BaseSepolia", { gateway: "0xc3D46e0266d95215589DE639cC4E93b79f88fc6C", tbtcToken: "" }],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, TbtcContracts]>;
