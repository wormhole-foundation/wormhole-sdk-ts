import {
  ChainName,
  Network,
  RoArray,
  constMap,
} from '@wormhole-foundation/connect-sdk';

const networkChainSolanaGenesisHashes = [
  ['Mainnet', [['Solana', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d']]],
  ['Testnet', [['Solana', 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG']]], // Note: this is referred to as `devnet` in sol
  ['Devnet', [['Solana', 'DJFsKjBLis7jFd5QpqjV4YbmGMFGfN93e8qhhzD3tsjr']]], // Note: this is only for local testing with Tilt
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const solGenesisHashToNetworkChainPair = constMap(
  networkChainSolanaGenesisHashes,
  [2, [0, 1]],
);

export const solNetworkChainToGenesisHash = constMap(
  networkChainSolanaGenesisHashes,
);
