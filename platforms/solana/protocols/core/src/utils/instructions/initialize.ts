import type {
  Connection,
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { createReadOnlyWormholeProgramInterface } from '../program.js';
import {
  deriveFeeCollectorKey,
  deriveGuardianSetKey,
  deriveWormholeBridgeDataKey,
} from './../accounts/index.js';
import BN from 'bn.js';

export function createInitializeInstruction(
  connection: Connection,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  guardianSetExpirationTime: number,
  fee: bigint,
  initialGuardians: Buffer[],
): TransactionInstruction {
  const methods = createReadOnlyWormholeProgramInterface(
    wormholeProgramId,
    connection,
  ).methods.initialize(guardianSetExpirationTime, new BN(fee.toString()), [
    ...initialGuardians.map((b) => [...new Uint8Array(b)]),
  ]);

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getInitializeAccounts(wormholeProgramId, payer) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface InitializeAccounts {
  bridge: PublicKey;
  guardianSet: PublicKey;
  feeCollector: PublicKey;
  payer: PublicKey;
  clock: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
}

export function getInitializeAccounts(
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
): InitializeAccounts {
  return {
    bridge: deriveWormholeBridgeDataKey(wormholeProgramId),
    guardianSet: deriveGuardianSetKey(wormholeProgramId, 0),
    feeCollector: deriveFeeCollectorKey(wormholeProgramId),
    payer: new PublicKey(payer),
    clock: SYSVAR_CLOCK_PUBKEY,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
  };
}
