import type { PublicKeyInitData } from '@solana/web3.js';
import type {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/sdk-connect';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

/**
 * Runtime value for the Solana Platform
 */
export const _platform: 'Solana' = 'Solana';
/**
 * Type for the Solana Platform
 */
export type SolanaPlatformType = typeof _platform;

export type SolanaChains = PlatformToChains<SolanaPlatformType>;
export type UniversalOrSolana = UniversalOrNative<SolanaChains>;
export type AnySolanaAddress = UniversalOrSolana | PublicKeyInitData;
