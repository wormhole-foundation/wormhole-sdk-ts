import { Network, chainConfigs } from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';

//TODO AMO this looks wrong to me
const sharedConfig = {
  network: 'Testnet',
  api: 'https://api.testnet.wormscan.io',
  chains: chainConfigs('Testnet'),
} as const;

export const CONFIG = {
  Mainnet: {
    network: 'Mainnet',
    api: 'https://api.wormscan.io',
    chains: chainConfigs('Mainnet'),
  },
  Testnet: sharedConfig,
  Devnet: sharedConfig,
} as const satisfies Record<Network, WormholeConfig>;
