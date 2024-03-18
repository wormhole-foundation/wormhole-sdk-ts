import { utils } from '@wormhole-foundation/sdk-solana';
import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { BN } from '@coral-xyz/anchor';
import { encoding } from '@wormhole-foundation/sdk-connect';

export function deriveTokenTransferMessageAddress(
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  sequence: BN,
): PublicKey {
  return utils.deriveAddress(
    [
      Buffer.from('bridged'),
      new PublicKey(payer).toBuffer(),
      Buffer.from(encoding.bignum.toBytes(BigInt(sequence.toString()), 8)),
    ],
    programId,
  );
}
