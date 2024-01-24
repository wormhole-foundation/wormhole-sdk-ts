import { _platform } from '@wormhole-foundation/connect-sdk-solana';
import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaWormholeCore } from './core';

registerProtocol(_platform, 'WormholeCore', SolanaWormholeCore);

export * from './core';
export * from './types';
export * as utils from './utils';
