import { BN } from '@project-serum/anchor';
import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { utils } from '@wormhole-foundation/connect-sdk-solana';

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
