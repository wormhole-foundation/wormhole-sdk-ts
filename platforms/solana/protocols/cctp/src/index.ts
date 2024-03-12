import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaCircleBridge } from './circleBridge';
import { _platform } from '@wormhole-foundation/sdk-solana';

registerProtocol(_platform, 'CircleBridge', SolanaCircleBridge);

import type { TokenMessenger} from './anchor-idl/tokenMessenger';
import { TokenMessengerIdl } from './anchor-idl/tokenMessenger';
import type {
  MessageTransmitter} from './anchor-idl/messageTransmitter';
import {
  MessageTransmitterIdl,
} from './anchor-idl/messageTransmitter';

export const idl = {
  TokenMessengerIdl,
  MessageTransmitterIdl,
};

export type { MessageTransmitter, TokenMessenger };
export * from './circleBridge';
