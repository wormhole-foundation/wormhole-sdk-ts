import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

// prettier-ignore
export const executorQuoterContracts = [[
  "Mainnet", [
    ["Monad",   "0x3d9282A8e9a3cdd9b25AE969eff4705a1Fe75F34"],
    ["Polygon", "0x2a856931603930B827B1A4352FB4D66fA029F123"],
  ]], [
  "Testnet", [
    ["Sepolia",         "0xc0C35D7bfBc4175e0991Ae294f561b433eA4158f"],
    ["ArbitrumSepolia", "0x5E8c14F436c9ed2ff2E8B042B0542136bf108C6f"],
    ["OptimismSepolia", "0x6a829dF7C91f35f9aD72Cd5d05550b95BbC9fd2F"],
    ["BaseSepolia",     "0x2507d6899C3D4b93BF46b555d0cB401f44065772"],
    ["Solana",          "qtrrrV7W3E1jnX1145wXR6ZpthG19ur5xHC1n6PPhDV"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
