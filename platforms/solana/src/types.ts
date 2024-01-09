import { PublicKeyInitData } from '@solana/web3.js';
import {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export const _platform: 'Solana' = 'Solana';
export type SolanaPlatformType = typeof _platform;

export type SolanaChains = PlatformToChains<SolanaPlatformType>;
export type UniversalOrSolana = UniversalOrNative<SolanaChains>;
export type AnySolanaAddress = UniversalOrSolana | PublicKeyInitData;
