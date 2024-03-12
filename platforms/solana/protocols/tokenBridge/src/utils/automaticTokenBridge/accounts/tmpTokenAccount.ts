import { utils } from '@wormhole-foundation/sdk-solana';
import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

export function deriveTmpTokenAccountAddress(
  programId: PublicKeyInitData,
  mint: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('tmp'), new PublicKey(mint).toBuffer()],
    programId,
  );
}
