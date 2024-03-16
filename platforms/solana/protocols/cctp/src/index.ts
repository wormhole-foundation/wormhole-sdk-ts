import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaCircleBridge } from './circleBridge.js';
import { _platform } from '@wormhole-foundation/sdk-solana';

registerProtocol(_platform, 'CircleBridge', SolanaCircleBridge);

import type { TokenMessenger } from './anchor-idl/tokenMessenger.js';
import { TokenMessengerIdl } from './anchor-idl/tokenMessenger.js';
import type { MessageTransmitter } from './anchor-idl/messageTransmitter.js';
import { MessageTransmitterIdl } from './anchor-idl/messageTransmitter.js';

export const idl = {
  TokenMessengerIdl,
  MessageTransmitterIdl,
};

export type { MessageTransmitter, TokenMessenger };
export * from './circleBridge.js';
