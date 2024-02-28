import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaCircleBridge } from './circleBridge';
import { _platform } from '@wormhole-foundation/sdk-solana';

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
