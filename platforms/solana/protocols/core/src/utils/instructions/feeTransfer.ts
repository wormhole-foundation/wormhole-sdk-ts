import type {
  PublicKeyInitData,
  TransactionInstruction,
} from '@solana/web3.js';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { deriveFeeCollectorKey } from './../accounts/index.js';

export function createBridgeFeeTransferInstruction(
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  fee: bigint,
): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: new PublicKey(payer),
    toPubkey: deriveFeeCollectorKey(wormholeProgramId),
    lamports: fee,
  });
}
