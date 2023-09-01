import { ChainName } from "./chains";
import { Network } from "./networks";
import { RoArray, ToMapping, column, constMap } from "../utils";

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
    ],
  ],
  ["Solana", ["Solana", "Pythnet"]],
  ["Cosmwasm", ["Terra", "Terra2", "Injective", "Xpla", "Sei"]],
  ["Btc", ["Btc"]],
  ["Algorand", ["Algorand"]],
  ["Sui", ["Sui"]],
  ["Aptos", ["Aptos"]],
  ["Osmosis", ["Osmosis"]],
  ["Wormchain", ["Wormchain"]],
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

const networkChainEvmCIdEntries = [
  [
    "Mainnet",
    [
      ["Ethereum", 1n],
      // TODO: forced to add this to match other list
      ["Sepolia", 0n],
      ["Bsc", 56n],
      ["Polygon", 137n],
      ["Avalanche", 43114n],
      ["Oasis", 42262n],
      ["Aurora", 1313161554n],
      ["Fantom", 250n],
      ["Karura", 686n],
      ["Acala", 787n],
      ["Klaytn", 8217n],
      ["Celo", 42220n],
      ["Moonbeam", 1284n],
      ["Neon", 245022934n],
      ["Arbitrum", 42161n],
      ["Optimism", 10n],
      ["Gnosis", 100n],
      ["Base", 8453n],
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", 5n], //goerli
      ["Sepolia", 11155111n], //actually just another ethereum testnet...
      ["Bsc", 97n],
      ["Polygon", 80001n], //mumbai
      ["Avalanche", 43113n], //fuji
      ["Oasis", 42261n],
      ["Aurora", 1313161555n],
      ["Fantom", 4002n],
      ["Karura", 596n],
      ["Acala", 597n],
      ["Klaytn", 1001n], //baobab
      ["Celo", 44787n], //alfajores
      ["Moonbeam", 1287n], //moonbase alpha
      ["Neon", 245022940n],
      ["Arbitrum", 421613n], //arbitrum goerli
      ["Optimism", 420n],
      ["Gnosis", 77n],
      ["Base", 84531n],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<"Evm">, bigint]>]
>;

export const evmChainIdToNetworkChainPair = constMap(
  networkChainEvmCIdEntries,
  [2, [0, 1]]
);
export const evmNetworkChainToEvmChainId = constMap(networkChainEvmCIdEntries);

const networkChainSolanaGenesisHashes = [
  ["Mainnet", [["Solana", "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"]]],
  ["Testnet", [["Solana", "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"]]], // Note: this is referred to as `devnet` in sol
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const solGenesisHashToNetworkChainPair = constMap(
  networkChainSolanaGenesisHashes,
  [2, [0, 1]]
);

export const solNetworkChainToGenesisHash = constMap(
  networkChainSolanaGenesisHashes
);
