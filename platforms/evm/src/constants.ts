import {
  Network,
  PlatformToChains,
  RoArray,
  constMap,
} from '@wormhole-foundation/connect-sdk';

const networkChainEvmCIdEntries = [
  [
    'Mainnet',
    [
      ['Ethereum', 1n],
      // TODO: forced to add this to match other list
      ['Sepolia', 0n],
      ['Bsc', 56n],
      ['Polygon', 137n],
      ['Avalanche', 43114n],
      ['Oasis', 42262n],
      ['Aurora', 1313161554n],
      ['Fantom', 250n],
      ['Karura', 686n],
      ['Acala', 787n],
      ['Klaytn', 8217n],
      ['Celo', 42220n],
      ['Moonbeam', 1284n],
      ['Neon', 245022934n],
      ['Arbitrum', 42161n],
      ['Optimism', 10n],
      ['Gnosis', 100n],
      ['Base', 8453n],
    ],
  ],
  [
    'Testnet',
    [
      ['Ethereum', 5n], //goerli
      ['Sepolia', 11155111n], //actually just another ethereum testnet...
      ['Bsc', 97n],
      ['Polygon', 80001n], //mumbai
      ['Avalanche', 43113n], //fuji
      ['Oasis', 42261n],
      ['Aurora', 1313161555n],
      ['Fantom', 4002n],
      ['Karura', 596n],
      ['Acala', 597n],
      ['Klaytn', 1001n], //baobab
      ['Celo', 44787n], //alfajores
      ['Moonbeam', 1287n], //moonbase alpha
      ['Neon', 245022940n],
      ['Arbitrum', 421613n], //arbitrum goerli
      ['Optimism', 420n],
      ['Gnosis', 77n],
      ['Base', 84531n],
    ],
  ],
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [PlatformToChains<'Evm'>, bigint]>]
>;

export const evmChainIdToNetworkChainPair = constMap(
  networkChainEvmCIdEntries,
  [2, [0, 1]],
);
export const evmNetworkChainToEvmChainId = constMap(networkChainEvmCIdEntries);
