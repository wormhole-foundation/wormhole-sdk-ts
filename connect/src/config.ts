import {
  Network,
  ChainName,
  chains,
  chainToPlatform,
  explorerConfigs,
  finalityThreshold,
  nativeDecimals,
  rpcAddress,
  RoArray,
  constMap,
  circleAPI,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';
import {
  getContracts,
  ChainConfig,
  ChainsConfig,
} from '@wormhole-foundation/sdk-definitions';

/*
TODO:
    add missing chains for each config
 Note: the false exclamation marks here are because not every chain
    is represented in the consts we're pulling from yet
*/
function combineConfig(n: Network): ChainsConfig {
  const cc: ChainsConfig = chains
    .map((c: ChainName): ChainConfig => {
      const platform = chainToPlatform(c);
      return {
        key: c,
        platform,
        finalityThreshold: finalityThreshold.get(n, c) || 0,
        contracts: getContracts(n, c),
        nativeTokenDecimals: nativeDecimals.get(platform)!, //TODO the exclamation mark is a lie
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
] as const satisfies RoArray<readonly [Network, ChainsConfig]>;

export const chainConfigs = constMap(chainConfigMapping);

export function networkPlatformConfigs(
  network: Network,
  platform: PlatformName,
): ChainsConfig {
  return Object.fromEntries(
    Object.entries(chainConfigs(network)).filter(([_, v]) => {
      return v.platform == platform;
    }),
  );
}

const sharedConfig: WormholeConfig = {
  network: 'Testnet',
  //api: 'https://api.testnet.wormholescan.io',
  api: 'https://api.testnet.wormscan.io',
  circleAPI: circleAPI('Testnet'),
  chains: chainConfigs('Testnet'),
} as const;

export const CONFIG = {
  Mainnet: {
    network: 'Mainnet',
    api: 'https://api.wormholescan.io',
    circleAPI: circleAPI('Mainnet'),
    chains: chainConfigs('Mainnet'),
  },
  Testnet: sharedConfig,
  Devnet: sharedConfig,
} as const satisfies Record<Network, WormholeConfig>;

export const DEFAULT_NETWORK: Network =
  (process.env.NETWORK as Network) || 'Testnet';
