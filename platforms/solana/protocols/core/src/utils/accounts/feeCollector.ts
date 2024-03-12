import type { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { utils } from '@wormhole-foundation/sdk-solana';

export function deriveFeeCollectorKey(
  wormholeProgramId: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress([Buffer.from('fee_collector')], wormholeProgramId);
}
