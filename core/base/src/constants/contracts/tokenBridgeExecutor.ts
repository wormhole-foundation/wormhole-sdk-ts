import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

// prettier-ignore
export const tokenBridgeExecutorRelayerContracts = [[
  "Mainnet", [
    // TODO: Add mainnet addresses when available
  ]], [
  "Testnet", [
    ["Sepolia",         "0x590667113BC1AA65817e1c9e9fE36A50Fd7a9702"],
    ["BaseSepolia",     "0x591d8E04ed85F7E4c893E14f975533C58a00bb2A"],
    ["Avalanche",       "0xa688da65dE0c625bD04174019F6FC81a884b7725"],
    ["Solana",          "tbr7Qje6qBzPwfM52csL5KFi8ps5c5vDyiVVBLYVdRf"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
