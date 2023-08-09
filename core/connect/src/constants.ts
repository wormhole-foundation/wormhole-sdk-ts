import { MAINNET, TESTNET, RPC_CONFIG } from '@wormhole-foundation/sdk-base';
import { WormholeConfig } from './types';

/**
 * default mainnet chain config
 */
export const MAINNET_CONFIG: WormholeConfig = {
  network: MAINNET,
  api: 'https://api.wormscan.io',
  rpcs: RPC_CONFIG.Mainnet,
  // TODO: why is this here?
  rest: { Sei: '' },
  chains: {},
};

/**
 * default testnet chain config
 */
export const TESTNET_CONFIG: WormholeConfig = {
  network: TESTNET,
  api: 'https://api.testnet.wormscan.io',
  rpcs: RPC_CONFIG.Testnet,
  // TODO: why is this here?
  // https://github.com/wormhole-foundation/connect-sdk/blob/main/packages/sei/src/context.ts#L238
  rest: { Sei: 'https://rest.atlantic-2.seinetwork.io' },
  chains: {},
};
