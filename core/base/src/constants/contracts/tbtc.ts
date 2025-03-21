import type { MapLevels } from "./../../utils/index.js";
import type { Chain } from "../chains.js";
import { Network } from "../networks.js";

// L2WormholeGateway contracts
export const tbtcContracts = [
  [
    "Mainnet",
    [
      ["Solana", "87MEvHZCXE3ML5rrmh5uX1FbShHmRXXS32xJDGbQ7h5t"],
      ["Polygon", "0x09959798B95d00a3183d20FaC298E4594E599eab"],
      ["Arbitrum", "0x1293a54e160D1cd7075487898d65266081A15458"],
      ["Optimism", "0x1293a54e160D1cd7075487898d65266081A15458"],
      ["Base", "0x09959798B95d00a3183d20FaC298E4594E599eab"],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, string]>;
