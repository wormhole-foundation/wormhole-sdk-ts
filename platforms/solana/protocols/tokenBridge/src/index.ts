import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaTokenBridge } from './tokenBridge';
import { SolanaAutomaticTokenBridge } from './automaticTokenBridge';

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Solana: {};
    }
  }
}

registerProtocol('Solana', 'TokenBridge', SolanaTokenBridge);
registerProtocol('Solana', 'AutomaticTokenBridge', SolanaAutomaticTokenBridge);

export * from './tokenBridgeType';
export * from './automaticTokenBridgeType';
export * from './utils';
export * from './tokenBridge';
export * from './automaticTokenBridge';
