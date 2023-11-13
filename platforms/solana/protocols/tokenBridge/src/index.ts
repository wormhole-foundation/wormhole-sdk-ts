import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaTokenBridge } from './tokenBridge';

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Solana: {};
    }
  }
}

registerProtocol('Solana', 'TokenBridge', SolanaTokenBridge);

export * from './types';
export * from './utils';
export * from './tokenBridge';
