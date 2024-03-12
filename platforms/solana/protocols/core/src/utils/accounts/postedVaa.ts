import type { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { utils } from '@wormhole-foundation/sdk-solana';

export function derivePostedVaaKey(
  wormholeProgramId: PublicKeyInitData,
  hash: Buffer,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('PostedVAA'), hash],
    wormholeProgramId,
  );
}
