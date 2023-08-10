import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { deriveAddress } from '../../utils/index.js';

export function deriveUpgradeAuthorityKey(
  wormholeProgramId: PublicKeyInitData,
): PublicKey {
  return deriveAddress([Buffer.from('upgrade')], wormholeProgramId);
}
