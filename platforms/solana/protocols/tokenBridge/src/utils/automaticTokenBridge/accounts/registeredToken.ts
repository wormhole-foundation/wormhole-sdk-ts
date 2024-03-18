import type { BN } from '@coral-xyz/anchor';
import type { PublicKeyInitData } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { utils } from '@wormhole-foundation/sdk-solana';

export interface RegisteredToken {
  swapRate: BN;
  maxNativeSwapAmount: BN;
}

export function deriveRegisteredTokenAddress(
  programId: PublicKeyInitData,
  mint: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress(
    [Buffer.from('mint'), new PublicKey(mint).toBuffer()],
    programId,
  );
}
