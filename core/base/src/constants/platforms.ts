//TODO alternative names:
// ChainType, ChainFamily, or just Family?

import { Chain } from "./chains";
import { column, toMapping, toMappingFunc, reverseArrayMapping } from "../utils/mapping";

const platformAndChainsEntries = [
  ["Evm",
    [
      "Ethereum", "Bsc", "Polygon", "Avalanche", "Oasis", "Aurora", "Fantom", "Karura", "Acala",
      "Klaytn", "Celo", "Moonbeam", "Neon", "Arbitrum", "Optimism" , "Gnosis", "Base", "Sepolia",
    ]
  ],
  ["Solana",    ["Solana", "Pythnet"]],
  ["Cosmwasm",  ["Terra", "Terra2", "Injective", "Xpla", "Sei"]],
  ["Btc",       ["Btc"]],
  //TODO don't know if any of the following chains actually share a platform with any other chain
  ["Algorand",  ["Algorand"]],
  ["Sui",       ["Sui"]],
  ["Aptos",     ["Aptos"]],
  ["Osmosis",   ["Osmosis"]],
  ["Wormchain", ["Wormchain"]],
  ["Near",      ["Near"]],
] as const satisfies readonly (readonly [string, readonly Chain[]])[];

export const platforms = column(platformAndChainsEntries, 0);
export type Platform = typeof platforms[number];

const platformToChainsMapping = toMapping(platformAndChainsEntries);
export const platformToChains = toMappingFunc(platformToChainsMapping);
export type PlatformToChainsMapping<P extends Platform> = typeof platformToChainsMapping[P][number];
const chainToPlatformMapping = reverseArrayMapping(platformToChainsMapping);
export const chainToPlatform = toMappingFunc(chainToPlatformMapping);
export type ChainToPlatformMapping<C extends Chain> = typeof chainToPlatformMapping[C];

export const inPlatform = (chain: Chain, platform: Platform):
  chain is typeof platformToChainsMapping[typeof platform][number] =>
  chain in platformToChainsMapping[platform];

export type NetworkChainPair = readonly ["Mainnet" | "Testnet", PlatformToChainsMapping<"Evm">];
const evmChainIdToNetworkChainEntries = [
  [         1n, ["Mainnet", "Ethereum"]],
  [         5n, ["Testnet", "Ethereum"]], //goerli
  [  11155111n, ["Testnet", "Sepolia"]], //actually just another ethereum testnet...
  [        56n, ["Mainnet", "Bsc"]],
  [        97n, ["Testnet", "Bsc"]],
  [       137n, ["Mainnet", "Polygon"]],
  [     80001n, ["Testnet", "Polygon"]], //mumbai
  [     43114n, ["Mainnet", "Avalanche"]],
  [     43113n, ["Testnet", "Avalanche"]], //fuji
  [     42262n, ["Mainnet", "Oasis"]],
  [     42261n, ["Testnet", "Oasis"]],
  [1313161554n, ["Mainnet", "Aurora"]],
  [1313161555n, ["Testnet", "Aurora"]],
  [       250n, ["Mainnet", "Fantom"]],
  [      4002n, ["Testnet", "Fantom"]],
  [       686n, ["Mainnet", "Karura"]],
  [       596n, ["Testnet", "Karura"]],
  [       787n, ["Mainnet", "Acala"]],
  [       597n, ["Testnet", "Acala"]],
  [      8217n, ["Mainnet", "Klaytn"]],
  [      1001n, ["Testnet", "Klaytn"]], //baobab
  [     42220n, ["Mainnet", "Celo"]],
  [     44787n, ["Testnet", "Celo"]], //alfajores
  [      1284n, ["Mainnet", "Moonbeam"]],
  [      1287n, ["Testnet", "Moonbeam"]], //moonbase alpha
  [ 245022934n, ["Mainnet", "Neon"]],
  //[        n, ["Testnet", "Neon"]], //TODO
  [     42161n, ["Mainnet", "Arbitrum"]],
  [    421613n, ["Testnet", "Arbitrum"]], //arbitrum goerli
  [        10n, ["Mainnet", "Optimism"]],
  [       420n, ["Testnet", "Optimism"]],
  [       100n, ["Mainnet", "Gnosis"]],
  [        77n, ["Testnet", "Gnosis"]],
  [      8453n, ["Mainnet", "Base"]],
  [     84531n, ["Testnet", "Base"]],
] as const satisfies readonly (readonly [bigint, NetworkChainPair])[];

const evmChainIdToNetworkChainMapping =
  new Map<bigint, NetworkChainPair>(evmChainIdToNetworkChainEntries);
//can't use toMapping here because bigint keys are not supported
export const evmChainIdToNetworkChainPair =
  (chainId: bigint) => evmChainIdToNetworkChainMapping.get(chainId);

//TODO more platform specific functions, e.g.:
//  Solana genesis block <-> (Chain, Network)
//  similar mappings for other platforms
// see: https://book.wormhole.com/reference/contracts.html

// Solana genesis blocks:
//   devnet: EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG (i.e. testnet for us)
//   testnet: 4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY << not used!
//   mainnet-beta: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d


//from here: https://github.com/wormhole-foundation/wormhole/blob/96c6cc2b325addc2125bb438b228921a4be6b7f3/ethereum/contracts/Implementation.sol#L39
// if (evmChainId() == 0) {
//   uint256 evmChainId;
//   uint16 chain = chainId();

//   // Wormhole chain ids explicitly enumerated
//   if        (chain == 2)  { evmChainId = 1;          // ethereum
//   } else if (chain == 4)  { evmChainId = 56;         // bsc
//   } else if (chain == 5)  { evmChainId = 137;        // polygon
//   } else if (chain == 6)  { evmChainId = 43114;      // avalanche
//   } else if (chain == 7)  { evmChainId = 42262;      // oasis
//   } else if (chain == 9)  { evmChainId = 1313161554; // aurora
//   } else if (chain == 10) { evmChainId = 250;        // fantom
//   } else if (chain == 11) { evmChainId = 686;        // karura
//   } else if (chain == 12) { evmChainId = 787;        // acala
//   } else if (chain == 13) { evmChainId = 8217;       // klaytn
//   } else if (chain == 14) { evmChainId = 42220;      // celo
//   } else if (chain == 16) { evmChainId = 1284;       // moonbeam
//   } else if (chain == 17) { evmChainId = 245022934;  // neon
//   } else if (chain == 23) { evmChainId = 42161;      // arbitrum
//   } else if (chain == 24) { evmChainId = 10;         // optimism
//   } else if (chain == 25) { evmChainId = 100;        // gnosis
//   } else {
//       revert("Unknown chain id.");
//   }

//   setEvmChainId(evmChainId);
// }
