import { ChainName } from "./chains";
import { RoArray, column, constMap } from "../utils";

const platformAndChainsEntries = [
  [
    "Evm",
    [
      "Ethereum",
      "Bsc",
      "Polygon",
      "Avalanche",
      "Oasis",
      "Aurora",
      "Fantom",
      "Karura",
      "Acala",
      "Klaytn",
      "Celo",
      "Moonbeam",
      "Neon",
      "Arbitrum",
      "Optimism",
      "Gnosis",
      "Base",
      "Sepolia",
      "Rootstock",
    ],
  ],
  ["Solana", ["Solana", "Pythnet"]],
  [
    "Cosmwasm",
    [
      "Terra",
      "Terra2",
      "Injective",
      "Xpla",
      "Sei",
      "Osmosis",
      "Wormchain",
      "Cosmoshub",
      "Evmos",
      "Kujira",
    ],
  ],
  ["Btc", ["Btc"]],
  ["Algorand", ["Algorand"]],
  ["Sui", ["Sui"]],
  ["Aptos", ["Aptos"]],
  ["Near", ["Near"]],
] as const satisfies RoArray<readonly [string, RoArray<ChainName>]>;

export const platforms = column(platformAndChainsEntries, 0);
export type PlatformName = (typeof platforms)[number];

export const platformToChains = constMap(platformAndChainsEntries);
export const chainToPlatform = constMap(platformAndChainsEntries, [1, 0]);

export const isPlatform = (platform: string): platform is PlatformName =>
  platformToChains.has(platform);

export type PlatformToChains<P extends PlatformName> = ReturnType<
  typeof platformToChains<P>
>[number];
export type ChainToPlatform<C extends ChainName> = ReturnType<
  typeof chainToPlatform<C>
>;
