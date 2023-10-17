import {
  PlatformToChains,
  UniversalAddress,
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

export const toSolanaAddrPublicKey = (addr: AnySolanaAddress) => {
  if (addr instanceof SolanaAddress) {
    return addr.unwrap();
  }
  return new SolanaAddress(addr).unwrap()
}

export const toSolanaAddrString = (addr: AnySolanaAddress) => {
  if (addr instanceof SolanaAddress) {
    return addr.toString();
  }
  return new SolanaAddress(addr).toString()
}
