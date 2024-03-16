import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { deriveAddress } from './account.js';

export class BpfLoaderUpgradeable {
  static programId: PublicKey = new PublicKey(
    'BPFLoaderUpgradeab1e11111111111111111111111',
  );
}

export function deriveUpgradeableProgramKey(programId: PublicKeyInitData) {
  return deriveAddress(
    [new PublicKey(programId).toBuffer()],
    BpfLoaderUpgradeable.programId,
  );
}
