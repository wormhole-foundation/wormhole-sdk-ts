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

import { TokenMessenger, TokenMessengerIdl } from './tokenMessenger';
import {
  MessageTransmitter,
  MessageTransmitterIdl,
} from './messageTransmitter';

export const idl = {
  TokenMessengerIdl,
  MessageTransmitterIdl,
};

export { MessageTransmitter, TokenMessenger };
export * from './circleBridge';
