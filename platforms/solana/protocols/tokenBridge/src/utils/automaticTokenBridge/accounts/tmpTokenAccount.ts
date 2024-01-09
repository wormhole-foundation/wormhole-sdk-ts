import { utils } from '@wormhole-foundation/connect-sdk-solana';
import { PublicKey, PublicKeyInitData } from '@solana/web3.js';

export function deriveTmpTokenAccountAddress(
  programId: PublicKeyInitData,
  mint: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('tmp'), new PublicKey(mint).toBuffer()],
    programId,
  );
}
