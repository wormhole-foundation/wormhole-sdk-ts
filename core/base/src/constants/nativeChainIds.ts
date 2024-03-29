import type { MapLevels, ToMapping, Widen } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";
import type { Platform, PlatformToChains } from "./platforms.js";
import { chainToPlatform } from "./platforms.js";

// prettier-ignore
const chainNetworkNativeChainIdEntries = [[
  "Aptos", [
    ["Mainnet", 1n],
    ["Testnet", 2n],
    ["Devnet",  0n],
  ]], [
  "Algorand", [
    ["Mainnet", "mainnet-v1.0"],
    ["Testnet", "testnet-v1.0"],
    ["Devnet",  "sandnet-v1.0"],
  ]], [
  "Near", [
    ["Mainnet", "mainnet"],
    ["Testnet", "testnet"],
  ]], [
  "Cosmoshub", [
    ["Mainnet", "cosmoshub-4"],
    ["Testnet", "theta-testnet-001"],
  ]], [
  "Evmos", [
    ["Mainnet", "evmos_9001-2"],
    ["Testnet", "evmos_9000-4"],
    ["Devnet",  "evmos_devnet_fake"],
  ]], [
  "Injective", [
    ["Mainnet", "injective-1"],
    ["Testnet", "injective-888"],
    ["Devnet",  "injective_devnet_fake"],
  ]], [
  "Osmosis", [
    ["Mainnet", "osmosis-1"],
    ["Testnet", "osmo-test-5"],
  ]], [
  "Sei", [
    ["Mainnet", "pacific-1"],
    ["Testnet", "atlantic-2"],
  ]], [
  "Terra", [
    ["Mainnet", "columbus-5"],
    ["Testnet", "bombay-12"],
  ]], [
  "Terra2", [
    ["Mainnet", "phoenix-1"],
    ["Testnet", "pisco-1"],
  ]], [
  "Wormchain", [
    ["Mainnet", "wormchain"],
    ["Testnet", "wormchain-testnet-0"],
  ]], [
  "Xpla", [
    ["Mainnet", "dimension_37-1"],
    ["Testnet", "cube_47-5"],
  ]], [
  "Kujira", [
    ["Mainnet", "kaiyo-1"],
    ["Testnet", "harpoon-4"],
  ]], [
  "Solana", [
    ["Mainnet", "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"],
    ["Testnet", "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"],
    ["Devnet",  "8wF6jKV3cKwyaVkWcoV9KpDqmkjvEYno9hKZrKx8TbZn"],
  ]], [
  "Sui", [
    ["Mainnet", "35834a8a"],
    ["Testnet", "4c78adac"],
  ]], [
  "Acala", [
    ["Mainnet", 787n],
    ["Testnet", 597n],
  ]], [
  "Arbitrum", [
    ["Mainnet", 42161n], //arbitrum goerli
    ["Testnet", 421613n],
  ]], [
  "Aurora", [
    ["Mainnet", 1313161554n],
    ["Testnet", 1313161555n],
  ]], [
  "Avalanche", [
    ["Mainnet", 43114n],
    ["Testnet", 43113n], //fuji
  ]], [
  "Base", [
    ["Mainnet", 8453n],
    ["Testnet", 84531n],
  ]], [
  "Bsc", [
    ["Mainnet", 56n],
    ["Testnet", 97n],
    ["Devnet",  1397n]
  ]], [
  "Celo", [
    ["Mainnet", 42220n],
    ["Testnet", 44787n], //alfajores
  ]], [
  "Ethereum", [
    ["Mainnet", 1n],
    ["Testnet", 5n], //goerli
    ["Devnet",  1337n]
  ]], [
  "Fantom", [
    ["Mainnet", 250n],
    ["Testnet", 4002n],
  ]], [
  "Gnosis", [
    ["Mainnet", 100n],
    ["Testnet", 10200n],
  ]], [
  "Karura", [
    ["Mainnet", 686n],
    ["Testnet", 596n],
  ]], [
  "Klaytn", [
    ["Mainnet", 8217n],
    ["Testnet", 1001n], //baobab
  ]], [
  "Moonbeam", [
    ["Mainnet", 1284n],
    ["Testnet", 1287n], //moonbase alpha
  ]], [
  "Neon", [
    ["Mainnet", 245022934n],
    ["Testnet", 245022940n],
  ]], [
  "Oasis", [
    ["Mainnet", 42262n],
    ["Testnet", 42261n],
  ]], [
  "Optimism", [
    ["Mainnet", 10n],
    ["Testnet", 420n],
  ]], [
  "Polygon", [
    ["Mainnet", 137n],
    ["Testnet", 80001n], //mumbai
  ]], [
  "Rootstock", [
    ["Mainnet", 30n],
    ["Testnet", 31n],
  ]], [
  "Sepolia", [
    ["Testnet", 11155111n]
  ]], [
  "ArbitrumSepolia", [
    ["Testnet", 421614n]
  ]], [
  "BaseSepolia", [
    ["Testnet", 84532n]
  ]], [
  "OptimismSepolia", [
    ["Testnet", 11155420n]
  ]], [
  "Holesky", [
    ["Testnet", 17000n]
  ]],[
  "Neutron", [
    ["Mainnet", "neutron-1"],
    ["Testnet", "pion-1"],
  ]],[
  "Stargaze", [
    ["Mainnet", "stargaze-1"]
  ]],[
  "Celestia", [
    ["Mainnet", "celestia"],
    ["Testnet", "mocha-4"]
  ]],[
  "Dymension", [
    ["Mainnet", "dymension_1100-1"]
  ]],[
  "Seda",[
    ["Testnet", "seda-1-testnet"],
  ]],[
  "PolygonSepolia", [
    ["Testnet", 80002n]
  ]],[
  "Mantle", [
    ["Mainnet", 5000n],
    ["Testnet", 5003n] // Sepolia testnet
  ]],
  [
  "Scroll", [
    ["Mainnet", 534352n],
    ["Testnet", 534351n],
  ]],
] as const satisfies MapLevels<[Chain, Network, bigint | string]>;

// @ts-ignore -- type instantiation too large and possibly infinite??
export const networkChainToNativeChainId = constMap(chainNetworkNativeChainIdEntries, [[1, 0], 2]);

//When mapping a Platform and native chain id to a network and chain pair, we assume that the
//  mapping is injective, i.e. that for any given platform there is only a single chain that
//  has the given chain id.
//Currently this is the case, in fact only Evm and Aptos share a chain id (1n).
const nativeChainIdToNetworkChain = constMap(chainNetworkNativeChainIdEntries, [2, [1, 0]]);

type NetworkChainToNativeChainId = ToMapping<typeof chainNetworkNativeChainIdEntries>;
export type PlatformToNativeChainIds<P extends Platform> = PlatformToChains<P> extends infer C
  ? C extends keyof NetworkChainToNativeChainId
    ? NetworkChainToNativeChainId[C][keyof NetworkChainToNativeChainId[C]]
    : never
  : never;

export type PlatformNativeChainIdToNetworkChainPair<
  P extends Platform,
  CI extends PlatformToNativeChainIds<P>,
> = PlatformToChains<P> extends infer C
  ? ReturnType<typeof nativeChainIdToNetworkChain<CI>>[number] extends infer NCP
    ? NCP extends readonly [Network, C]
      ? NCP
      : never
    : never
  : never;

export function platformNativeChainIdToNetworkChain<
  P extends Platform,
  CI extends PlatformToNativeChainIds<P>,
>(platform: P, chainId: Widen<CI>): PlatformNativeChainIdToNetworkChainPair<P, CI> {
  //typescript really struggles to comprehend the types here so we have to help it out
  const candidates = nativeChainIdToNetworkChain(
    chainId as PlatformToNativeChainIds<P>,
  ) as readonly (readonly [Network, Chain])[];
  const mustBeSingleton = candidates.filter(([_, chain]) => chainToPlatform(chain) === platform);
  if (mustBeSingleton.length !== 1)
    throw new Error(`Platform ${platform} has multiple chains with native chain id ${chainId}`);

  return mustBeSingleton[0] as any;
}
