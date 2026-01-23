import type { MapLevels } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Network } from "./networks.js";
import type { Chain } from "./chains.js";

// prettier-ignore
const graphQLConfig = [[
  "Mainnet", [
    ["Sui", "https://graphql.mainnet.sui.io/graphql"],
  ]], [
  "Testnet", [
    ["Sui", "https://graphql.testnet.sui.io/graphql"],
  ]], [
  "Devnet", [
  ]],
] as const satisfies MapLevels<[Network, Chain, string]>;

const graphQL = constMap(graphQLConfig);

export const graphQLAddress = (network: Network, chain: Chain) => graphQL.get(network, chain) ?? "";
