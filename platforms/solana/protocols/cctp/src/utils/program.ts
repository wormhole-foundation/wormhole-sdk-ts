import type { Connection, PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { Provider } from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

import { utils } from '@wormhole-foundation/sdk-solana';
import type { TokenMessenger, MessageTransmitter } from './../index.js';
import { idl } from './../index.js';

export function createTokenMessengerProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<TokenMessenger> {
  return new Program<TokenMessenger>(
    idl.TokenMessengerIdl,
    new PublicKey(programId),
    provider === undefined ? ({ connection: null } as any) : provider,
  );
}

export function createReadOnlyTokenMessengerProgramInterface(
  programId: PublicKeyInitData,
  connection?: Connection,
): Program<TokenMessenger> {
  return createTokenMessengerProgramInterface(
    programId,
    utils.createReadOnlyProvider(connection),
  );
}

export function createMessageTransmitterProgramInterface(
  programId: PublicKeyInitData,
  provider?: Provider,
): Program<MessageTransmitter> {
  return new Program<MessageTransmitter>(
    idl.MessageTransmitterIdl,
    new PublicKey(programId),
    provider === undefined ? ({ connection: null } as any) : provider,
  );
}

export function createReadOnlyMessageTransmitterProgramInterface(
  programId: PublicKeyInitData,
  connection?: Connection,
): Program<MessageTransmitter> {
  return createMessageTransmitterProgramInterface(
    programId,
    utils.createReadOnlyProvider(connection),
  );
}
