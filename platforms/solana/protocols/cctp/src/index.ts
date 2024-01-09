import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { SolanaCircleBridge } from './circleBridge';
import { _platform } from '@wormhole-foundation/connect-sdk-solana';

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Solana: {};
    }
  }
}

registerProtocol(_platform, 'CircleBridge', SolanaCircleBridge);

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
