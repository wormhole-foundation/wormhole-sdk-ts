import { utils } from '@wormhole-foundation/sdk-solana';
import type { PublicKey, PublicKeyInitData } from '@solana/web3.js';

export interface SenderConfig {
  owner: PublicKey;
  bump: number;
  tokenBridge: any;
  relayerFeePrecision: number;
  paused: boolean;
}

export function deriveSenderConfigAddress(
  programId: PublicKeyInitData,
): PublicKey {
  return utils.deriveAddress([Buffer.from('sender')], programId);
}
