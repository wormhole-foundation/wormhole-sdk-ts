import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { deriveAddress } from '../../utils';

export function derivePostedVaaKey(
  wormholeProgramId: PublicKeyInitData,
  hash: Buffer,
): PublicKey {
  return deriveAddress([Buffer.from('PostedVAA'), hash], wormholeProgramId);
}
