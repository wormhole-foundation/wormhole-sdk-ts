import { SolanaPlatform } from '@wormhole-foundation/connect-sdk-solana';
import { SolanaTokenBridge } from './tokenBridge';

export function registerProtocols(): void {
    // Register this module with the EVM module
    SolanaPlatform.registerProtocol('TokenBridge', SolanaTokenBridge);
}


export * from './types';
export * from './utils';
export * from './tokenBridge';
