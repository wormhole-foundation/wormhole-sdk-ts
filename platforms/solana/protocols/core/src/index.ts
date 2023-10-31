import { SolanaPlatform } from '@wormhole-foundation/connect-sdk-solana';
import { SolanaWormholeCore } from './core';

export function registerProtocols(): void {
    // Register this module with the EVM module
    SolanaPlatform.registerProtocol('WormholeCore', SolanaWormholeCore);
}


export * from './core';
export * from './types';
export * as utils from './utils';
