import { _platform } from '@wormhole-foundation/sdk-solana';
import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaWormholeCore } from './core.js';

registerProtocol(_platform, 'WormholeCore', SolanaWormholeCore);

export * from './core.js';
export * from './types.js';
export * as utils from './utils/index.js';
export * from './postMessageLayout.js';
