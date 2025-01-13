import type { MapLevel, RoArray } from "./../utils/index.js";
import { column, constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";

// prettier-ignore
const platformAndChainsEntries = [[
  "Evm", [
    "Acala",
    "Arbitrum",
    "Aurora",
    "Avalanche",
    "Base",
    "Bsc",
    "Celo",
    "Ethereum",
    "Fantom",
    "Gnosis",
    "Karura",
    "Klaytn",
    "Moonbeam",
    "Neon",
    "Oasis",
    "Optimism",
    "Polygon",
    "Rootstock",
    "Sepolia",
    "ArbitrumSepolia",
    "BaseSepolia",
    "OptimismSepolia",
    "Holesky",
    "PolygonSepolia",
    "Mantle",
    "Scroll",
    "Blast",
    "Xlayer",
    "Linea",
    "Berachain",
    "Seievm",
    "Snaxchain",
    "Unichain",
    "Worldchain",
    "Ink",
    "HyperEVM",
    "Monad",
    "MonadDevnet",
  ]], [
  "Solana", [
    "Solana",
    "Pythnet"
  ]], [
  "Cosmwasm", [
    "Cosmoshub",
    "Evmos",
    "Injective",
    "Kujira",
    "Osmosis",
    "Sei",
    "Terra",
    "Terra2",
    "Wormchain",
    "Xpla",
    "Dymension",
    "Neutron",
    "Stargaze",
    "Celestia",
    "Seda",
    "Provenance",
    "Noble"
  ]], [
    "Btc", [
      "Btc"
  ]], [
    "Algorand", [
      "Algorand"
  ]], [
    "Sui", [
      "Sui"
  ]], [
    "Aptos", [
      "Aptos"
  ]], [
    "Near", [
      "Near"
  ]],
] as const satisfies MapLevel<string, RoArray<Chain>>;

export const platforms = column(platformAndChainsEntries, 0);
export type Platform = (typeof platforms)[number];

export const platformToChains = constMap(platformAndChainsEntries);
export const chainToPlatform = constMap(platformAndChainsEntries, [1, 0]);

export const isPlatform = (platform: string): platform is Platform =>
  platformToChains.has(platform);

export type PlatformToChains<P extends Platform> = ReturnType<typeof platformToChains<P>>[number];
export type ChainToPlatform<C extends Chain> = ReturnType<typeof chainToPlatform<C>>;

// prettier-ignore
const platformAddressFormatEntries = [
  ["Evm",       "hex"],
  ["Solana",    "base58"],
  ["Cosmwasm",  "bech32"],
  ["Btc",       "bech32"], //though we currently don't have any btc addresses
  ["Algorand",  "algorandAppId"],
  ["Sui",       "hex"],
  ["Aptos",     "hex"],
  ["Near",      "sha256"],
] as const;

export const platformToAddressFormat = constMap(platformAddressFormatEntries);
export type PlatformAddressFormat = (typeof platformAddressFormatEntries)[number][1];
