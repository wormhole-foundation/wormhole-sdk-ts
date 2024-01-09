import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  deriveWormholeBridgeDataKey,
  deriveFeeCollectorKey,
  deriveEmitterSequenceKey,
  getEmitterKeys,
} from '../accounts';
import { createReadOnlyWormholeProgramInterface } from '../program';

/** All accounts required to make a cross-program invocation with the Core Bridge program */
export interface PostMessageAccounts {
  bridge: PublicKey;
  message: PublicKey;
  emitter: PublicKey;
  sequence: PublicKey;
  payer: PublicKey;
  feeCollector: PublicKey;
  clock: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
}

export function createPostMessageInstruction(
  connection: Connection,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  messageAccount: PublicKeyInitData,
  payload: Uint8Array,
  nonce: number,
  consistencyLevel: number,
): TransactionInstruction {
  const methods = createReadOnlyWormholeProgramInterface(
    wormholeProgramId,
    connection,
  ).methods.postMessage(nonce, Buffer.from(payload), consistencyLevel);

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getPostMessageAccounts(wormholeProgramId, payer, messageAccount),
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export function getPostMessageAccounts(
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  message: PublicKeyInitData,
  emitter?: PublicKeyInitData,
): PostMessageAccounts {
  let sequence;
  if (emitter) {
    ({ emitter, sequence } = getEmitterKeys(emitter, wormholeProgramId));
  } else {
    emitter = payer;
    sequence = deriveEmitterSequenceKey(emitter, wormholeProgramId);
  }
  return {
    bridge: deriveWormholeBridgeDataKey(wormholeProgramId),
    message: new PublicKey(message),
    emitter: new PublicKey(emitter),
    sequence,
    payer: new PublicKey(payer),
    feeCollector: deriveFeeCollectorKey(wormholeProgramId),
    clock: SYSVAR_CLOCK_PUBKEY,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
  };
}
