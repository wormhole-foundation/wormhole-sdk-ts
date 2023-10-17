import {
  PlatformToChains,
  UniversalOrNative,
  registerNative,
} from '@wormhole-foundation/connect-sdk';
import { PublicKeyInitData } from '@solana/web3.js';
import { SolanaAddress } from './address';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

registerNative('Solana', SolanaAddress);

export type SolanaChainName = PlatformToChains<'Solana'>;
export type UniversalOrSolana = UniversalOrNative<'Solana'>;
export type AnySolanaAddress = UniversalOrSolana | PublicKeyInitData;
