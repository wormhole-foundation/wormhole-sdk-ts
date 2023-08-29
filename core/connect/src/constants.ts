import {
  Network,
  ChainName,
  chains,
  PlatformName,
  chainToPlatform,
  ExplorerSettings,
  contracts,
  explorerConfigs,
  finalityThreshold,
  nativeDecimals,
  rpcAddress,
  RoArray,
  constMap,
  circleAPI,
} from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';

export type Contracts = {
  coreBridge?: string;
  tokenBridge?: string;
  nftBridge?: string;
  relayer?: string;
  cctp: {
    tokenMessenger?: string;
    messageTransmitter?: string;
    wormholeRelayer?: string;
    wormhole?: string;
  };
};

export type ChainConfig = {
  key: ChainName;
  platform: PlatformName;
  contracts: Contracts;
  finalityThreshold: number;
  nativeTokenDecimals: number;
  explorer: ExplorerSettings;
  rpc: string;
};

type NetworkChainConfigs = {
  [K in ChainName]?: ChainConfig;
};

function selectContracts(n: Network, c: ChainName): Contracts {
  return {
    coreBridge: contracts.coreBridge.get(n, c),
    tokenBridge: contracts.tokenBridge.get(n, c),
    nftBridge: contracts.nftBridge.get(n, c),
    relayer: contracts.relayer.get(n, c),
    cctp: {
      tokenMessenger: contracts.cctpTokenMessenger.get(n, c),
      messageTransmitter: contracts.cctpMessageTransmitter.get(n, c),
      wormholeRelayer: contracts.cctpWormholeRelayer.get(n, c),
      wormhole: contracts.cctpWormhole.get(n, c),
    },
  };
}

/*
TODO:
    add missing chains for each config
 Note: the false exclamation marks here are because not every chain
    is represented in the consts we're pulling from yet
*/
function combineConfig(n: Network): NetworkChainConfigs {
  const cc: NetworkChainConfigs = chains
    .map((c: ChainName): ChainConfig => {
      return {
        key: c,
        platform: chainToPlatform(c),
        finalityThreshold: finalityThreshold.get(n, c)!, //TODO the exclamation mark is a lie
        contracts: selectContracts(n, c),
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
