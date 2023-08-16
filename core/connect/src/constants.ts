import {
  Network,
  ChainName,
  chains,
  PlatformName,
  chainToPlatform,
  Contracts,
  ExplorerSettings,
  explorerConfigs,
  finalityThreshold,
  nativeDecimals,
  toMappingFunc,
  rpcAddress,
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
 Note: the `ts-ignore`s here are because not every chain
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
        // @ts-ignore
        finalityThreshold: finalityThreshold(n)[c],
        // @ts-ignore
        nativeDecimals: nativeDecimals(c),
        // @ts-ignore
        explorer: explorerConfigs(n)[c],
        // @ts-ignore
        rpc: rpcAddress(n)[c],
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}

// Combine all the configs for each network/chain
const chainConfigMapping = {
  Mainnet: combineConfig('Mainnet'),
  Testnet: combineConfig('Testnet'),
  Devnet: combineConfig('Devnet'),
} as const satisfies Record<Network, NetworkChainConfigs>;

export const chainConfigs = toMappingFunc(chainConfigMapping);

const sharedConfig = {
  network: 'Testnet',
  api: 'https://api.testnet.wormholescan.io',
  chains: chainConfigs('Testnet'),
} as const;

export const CONFIG = {
  Mainnet: {
    network: 'Mainnet',
    api: 'https://api.wormholescan.io',
    chains: chainConfigs('Mainnet'),
  },
  Testnet: sharedConfig,
  Devnet: sharedConfig,
} as const satisfies Record<Network, WormholeConfig>;
