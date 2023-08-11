import { rpcAddress, Network } from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';

//TODO AMO this looks wrong to me
const sharedConfig = {
  network: 'Testnet',
  api: 'https://api.testnet.wormscan.io',
  rpcs: rpcAddress('Testnet'),
  // TODO: why is this here?
  // https://github.com/wormhole-foundation/connect-sdk/blob/main/packages/sei/src/context.ts#L238
  rest: { Sei: 'https://rest.atlantic-2.seinetwork.io' },
  chains: {},
} as const;

export const CONFIG = {
  Mainnet: {
    network: 'Mainnet',
    api: 'https://api.wormscan.io',
    rpcs: rpcAddress('Mainnet'),
    // TODO: why is this here?
    rest: { Sei: '' },
    chains: {},
  },
  Testnet: sharedConfig,
  Devnet: sharedConfig,
} as const satisfies Record<Network, WormholeConfig>;
