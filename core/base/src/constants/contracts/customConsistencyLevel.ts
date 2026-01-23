import type { MapLevels } from "./../../utils/index.js";
import type { Network } from "../networks.js";
import type { Chain } from "../chains.js";

// prettier-ignore
export const customConsistencyLevelContracts = [[
  "Mainnet", [
    ["Ethereum", "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
    ["Linea",    "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
  ]], [
  "Testnet", [
    ["Ethereum", "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
    ["Sepolia",  "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
    ["Linea",    "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
  ]], [
  "Devnet", [
    ["Ethereum", "0x6A4B4A882F5F0a447078b4Fd0b4B571A82371ec2"],
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;
