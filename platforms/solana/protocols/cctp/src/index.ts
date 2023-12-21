import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaCircleBridge } from './circleBridge';

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Solana: {};
    }
  }
}

registerProtocol('Solana', 'CircleBridge', SolanaCircleBridge);

import { TokenMessenger, TokenMessengerIdl } from './anchor-idl/tokenMessenger';
import {
  MessageTransmitter,
  MessageTransmitterIdl,
} from './anchor-idl/messageTransmitter';

export const idl = {
  TokenMessengerIdl,
  MessageTransmitterIdl,
};

export { MessageTransmitter, TokenMessenger };
export * from './circleBridge';
