import {
  ChainName,
  Network,
  RoArray,
  constMap,
} from '@wormhole-foundation/connect-sdk';

const networkChainAlgorandGenesisHashes = [
  ['Mainnet', [['Algorand', 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=']]],
  ['Testnet', [['Algorand', 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=']]], // Note: this is referred to as `devnet` in sol
  ['Devnet', [['Algorand', '']]], // Note: this is only for local testing with Tilt
] as const satisfies RoArray<
  readonly [Network, RoArray<readonly [ChainName, string]>]
>;

export const algorandGenesisHashToNetworkChainPair = constMap(
  networkChainAlgorandGenesisHashes,
  [2, [0, 1]],
);

export const algorandNetworkChainToGenesisHash = constMap(
  networkChainAlgorandGenesisHashes,
);
