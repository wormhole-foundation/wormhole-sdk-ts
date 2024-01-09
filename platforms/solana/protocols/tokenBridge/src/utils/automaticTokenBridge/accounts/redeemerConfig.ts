import { PublicKey, PublicKeyInitData } from '@solana/web3.js';
import { utils } from '@wormhole-foundation/connect-sdk-solana';

export interface RedeemerConfig {
  owner: PublicKey;
  bump: number;
  relayerFeePrecision: number;
  feeRecipient: PublicKey;
}

export function deriveRedeemerConfigAddress(
  programId: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress([Buffer.from('redeemer')], programId);
}
