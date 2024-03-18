import { utils } from '@wormhole-foundation/sdk-solana';
import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';

export interface SignerSequence {
  value: BN;
}

export function deriveSignerSequenceAddress(
  programId: PublicKeyInitData,
  payerKey: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('seq'), new PublicKey(payerKey).toBuffer()],
    programId,
  );
}
