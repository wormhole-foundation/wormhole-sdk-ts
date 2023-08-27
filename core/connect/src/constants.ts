import {
  Network,
  ChainName,
  chains,
  PlatformName,
  chainToPlatform,
  Contracts,
  ExplorerSettings,
  contracts,
  explorerConfigs,
  finalityThreshold,
  nativeDecimals,
  rpcAddress,
  RoArray,
  constMap,
} from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';

export type ChainConfig = {
  key: ChainName;
  platform: PlatformName;
  contracts: Contracts;
  finalityThreshold: number;
  nativeTokenDecimals: number;
  explorer: ExplorerSettings;
  rpc: string;
};

/*
TODO:
    add missing chains for each config
 Note: the false exclamation marks here are because not every chain
    is represented in the consts we're pulling from yet
*/

type NetworkChainConfigs = {
  [K in ChainName]?: ChainConfig;
};

function combineConfig(n: Network): NetworkChainConfigs {
  const cc: NetworkChainConfigs = chains
    .map((c: ChainName): ChainConfig => {
      return {
        key: c,
        platform: chainToPlatform(c),
        finalityThreshold: finalityThreshold.get(n, c)!, //TODO the exclamation mark is a lie
        contracts: contracts[n][c],
        nativeTokenDecimals: nativeDecimals.get(c)!, //TODO the exclamation mark is a lie
        explorer: explorerConfigs(n, c)!, //TODO the exclamation mark is a lie
        rpc: rpcAddress(n, c)!, //TODO the exclamation mark is a lie
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}

// Combine all the configs for each network/chain
const chainConfigMapping = [
  ['Mainnet', combineConfig('Mainnet')],
  ['Testnet', combineConfig('Testnet')],
  ['Devnet', combineConfig('Devnet')],
] as const satisfies RoArray<readonly [Network, NetworkChainConfigs]>;

export const chainConfigs = constMap(chainConfigMapping);

const sharedConfig: WormholeConfig = {
  network: 'Testnet',
  api: 'https://api.testnet.wormholescan.io',
  circleAPI: 'https://iris-api-sandbox.circle.com/v1/attestations',
  chains: chainConfigs('Testnet'),
} as const;

export const CONFIG = {
  Mainnet: {
    network: 'Mainnet',
    api: 'https://api.wormholescan.io',
    circleAPI: 'https://iris-api.circle.com/v1/attestations',
    chains: chainConfigs('Mainnet'),
  },
  Testnet: sharedConfig,
  Devnet: sharedConfig,
} as const satisfies Record<Network, WormholeConfig>;
