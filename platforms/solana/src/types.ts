import {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';
import { PublicKeyInitData } from '@solana/web3.js';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type SolanaChain = PlatformToChains<'Solana'>;
export type UniversalOrSolana = UniversalOrNative<'Solana'>;
export type AnySolanaAddress = UniversalOrSolana | PublicKeyInitData;
