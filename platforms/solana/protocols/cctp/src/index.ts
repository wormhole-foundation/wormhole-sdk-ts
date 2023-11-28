import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaCircleBridge } from './circleBridge';

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Solana: {};
    }
  }
}

registerProtocol('Solana', 'CircleBridge', SolanaCircleBridge);

export * from './anchor-idl';

export * from './tokenMessenger';
export * from './messageTransmitter';
export * from './circleBridge';
