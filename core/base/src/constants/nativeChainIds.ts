import type { MapLevels, ToMapping, Widen } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";
import type { Network } from "./networks.js";
import type { Platform, PlatformToChains } from "./platforms.js";
import { chainToPlatform } from "./platforms.js";

// prettier-ignore
const chainNetworkNativeChainIdEntries = [
  [
    "Mainnet",
    [
      ["Aptos",     1n],
      ["Algorand",  "mainnet-v1.0"],
      ["Near",      "mainnet"],
      ["Cosmoshub", "cosmoshub-4"],
      ["Evmos",     "evmos_9001-2"],
      ["Injective", "injective-1"],
      ["Osmosis",   "osmosis-1"],
      ["Sei",       "pacific-1"],
      ["Wormchain", "wormchain"],
      ["Kujira",    "kaiyo-1"],
      ["Solana",    "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"],
      ["Sui",       "35834a8a"],
      ["Arbitrum",  42161n],
      ["Avalanche", 43114n],
      ["Base",      8453n],
      ["Bsc",       56n],
      ["Celo",      42220n],
      ["Ethereum",  1n],
      ["Fantom",    250n],
      ["Klaytn",    8217n],
      ["Moonbeam",  1284n],
      ["Optimism",  10n],
      ["Polygon",   137n],
      ["Neutron",   "neutron-1"],
      ["Stargaze",  "stargaze-1"],
      ["Celestia",  "celestia"],
      ["Dymension", "dymension_1100-1"],
      ["Provenance","pio-mainnet-1"],
      ["Noble",     "noble-1"],
      ["Xlayer",    196n],
      ["Mantle",    5000n],
      ["Scroll",    534352n],
      ["Linea",     59144n],
      ["Berachain", 80094n],
      ["Seievm",    1329n],
      ["Unichain",  130n],
      ["Worldchain",480n],
      ["Ink",       57073n],
      ["Sonic",     146n],
      ["HyperEVM",  999n],
      ["HyperCore", 20000n],
      ["Mezo",      31612n],
      ["Plume",     98866n],
      ["XRPLEVM",   1440000n],
      ["Stacks",    1n],
    ],
  ],
  [
    "Testnet",
    [
      ["Aptos",           2n],
      ["Algorand",        "testnet-v1.0"],
      ["Near",            "testnet"],
      ["Cosmoshub",       "theta-testnet-001"],
      ["Evmos",           "evmos_9000-4"],
      ["Injective",       "injective-888"],
      ["Osmosis",         "osmo-test-5"],
      ["Sei",             "atlantic-2"],
      ["Wormchain",       "wormchain-testnet-0"],
      ["Kujira",          "harpoon-4"],
      ["Solana",          "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"],
      ["Sui",             "4c78adac"],
      ["Arbitrum",        421613n],
      ["Avalanche",       43113n], //fuji
      ["Base",            84531n],
      ["Bsc",             97n],
      ["Celo",            44787n], //alfajores
      ["Ethereum",        5n], //goerli
      ["Fantom",          4002n],
      ["Klaytn",          1001n], //baobab
      ["Moonbeam",        1287n], //moonbase alpha
      ["Optimism",        420n],
      ["Polygon",         80001n], //mumbai
      ["Sepolia",         11155111n],
      ["ArbitrumSepolia", 421614n],
      ["BaseSepolia",     84532n],
      ["OptimismSepolia", 11155420n],
      ["PolygonSepolia",  80002n],
      ["Holesky",         17000n],
      ["Neutron",         "pion-1"],
      ["Celestia",        "mocha-4"],
      ["Seda",            "seda-1-testnet"],
      ["Noble",           "grand-1"],
      ["Mantle",          5003n], // Sepolia testnet
      ["Scroll",          534351n],
      ["Berachain",       80069n], // Testnet v3
      ["Seievm",          1328n],
      ["Unichain",        1301n],
      ["Worldchain",      4801n],
      ["Ink",             763373n],
      ["HyperEVM",        998n],
      ["HyperCore",       20000n],
      ["Xlayer",          195n],
      ["Linea",           59141n], // Sepolia
      ["Monad",           10143n],
      ["Mezo",            31611n],
      ["Sonic",           57054n],
      ["Converge",        52085145n],
      ["Fogo",            "9GGSFo95raqzZxWqKM5tGYvJp5iv4Dm565S4r8h5PEu9"], // genesis hash
      ["Plume",           98867n],
      ["XRPLEVM",         1449000n],
      ["Stacks",          2147483648n],
    ],
  ],
  [
    "Devnet",
    [
      ["Aptos",     0n],
      ["Algorand", "sandnet-v1.0"],
      ["Bsc",       1397n],
      ["Ethereum",  1337n],
      ["Injective","injective_devnet_fake"],
      ["Solana",    "8wF6jKV3cKwyaVkWcoV9KpDqmkjvEYno9hKZrKx8TbZn"],
      ["Stacks",    2147483648n],
    ],
  ],
] as const satisfies MapLevels<[Network, Chain, bigint | string]>;

export const networkChainToNativeChainId = constMap(chainNetworkNativeChainIdEntries);

type NetworkChainToNativeChainId = ToMapping<typeof chainNetworkNativeChainIdEntries>;
export type PlatformToNativeChainIds<P extends Platform, N extends Network = Network> =
  PlatformToChains<P> extends infer C
    ? C extends keyof NetworkChainToNativeChainId[N]
      ? NetworkChainToNativeChainId[N][C]
      : // If the platform doesn't support the network, return the widened type for
        // mainnet
        C extends keyof NetworkChainToNativeChainId["Mainnet"]
        ? Widen<NetworkChainToNativeChainId["Mainnet"][C]>
        : never
    : never;

//When mapping a Platform and native chain id to a network and chain pair, we assume that the
//  mapping is injective, i.e. that for any given platform there is only a single chain that
//  has the given chain id.
//Currently this is the case, in fact only Evm and Aptos share a chain id (1n).
const nativeChainIdToNetworkChain = constMap(chainNetworkNativeChainIdEntries, [2, [0, 1]]);
export type PlatformNativeChainIdToNetworkChainPair<P extends Platform> =
  PlatformToChains<P> extends infer C
    ? ReturnType<typeof nativeChainIdToNetworkChain>[number] extends infer NCP
      ? NCP extends readonly [Network, C]
        ? NCP
        : never
      : never
    : never;

export function platformNativeChainIdToNetworkChain<
  P extends Platform,
  CI extends PlatformToNativeChainIds<P>,
>(platform: P, chainId: Widen<CI>): PlatformNativeChainIdToNetworkChainPair<P> {
  //typescript really struggles to comprehend the types here so we have to help it out
  //@ts-ignore
  const candidates = nativeChainIdToNetworkChain(chainId) as readonly (readonly [Network, Chain])[];
  const mustBeSingleton = candidates.filter(([_, chain]) => chainToPlatform(chain) === platform);
  if (mustBeSingleton.length !== 1)
    throw new Error(`Platform ${platform} has multiple chains with native chain id ${chainId}`);

  return mustBeSingleton[0] as any;
}
