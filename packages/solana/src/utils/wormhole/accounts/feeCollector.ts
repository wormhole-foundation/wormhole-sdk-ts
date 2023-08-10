import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { deriveAddress } from '../../utils/index.js';

export function deriveFeeCollectorKey(
  wormholeProgramId: PublicKeyInitData,
): PublicKey {
  return deriveAddress([Buffer.from('fee_collector')], wormholeProgramId);
}
