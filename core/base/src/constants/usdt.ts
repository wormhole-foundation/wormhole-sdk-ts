import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";

// prettier-ignore
const usdtContracts = [[
  "Mainnet", [
      // Non exhaustive list of USDT addresses
      ["Arbitrum", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"],
      ["Avalanche", "0x9702230A8Ea53601f5cD2dc00fDbC13d4dF4A8c7"],
      ["Base", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"],
      ["Bsc", "0x55d398326f99059fF775485246999027B3197955"],
      ["Celo", "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"],
      ["Ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7"],
      ["Optimism", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58"],
      ["Polygon", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"],
      ["Solana", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"],
      ["Monad", "0xe7cd86e13AC4309349F30B3435a9d337750fC82D"],
      ["Unichain", "0x9151434b16b9763660705744891fA906F660EcC5"],
  ]],
] as const satisfies MapLevel<Network, MapLevel<Chain, string>>;

export const usdtContract = constMap(usdtContracts);
