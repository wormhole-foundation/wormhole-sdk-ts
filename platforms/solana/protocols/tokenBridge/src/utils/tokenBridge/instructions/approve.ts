import { createApproveInstruction } from '@solana/spl-token';
import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { deriveAuthoritySignerKey } from './../accounts/index.js';

export function createApproveAuthoritySignerInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  tokenAccount: PublicKeyInitData,
  owner: PublicKeyInitData,
  amount: number | bigint,
) {
  return createApproveInstruction(
    new PublicKey(tokenAccount),
    deriveAuthoritySignerKey(tokenBridgeProgramId),
    new PublicKey(owner),
    amount,
  );
}
