import { utils } from '@wormhole-foundation/sdk-solana';
import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
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
