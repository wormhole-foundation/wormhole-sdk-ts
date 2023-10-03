import {
  PlatformToChains,
  UniversalAddress,
  UniversalOrNative,
  registerNative,
} from '@wormhole-foundation/connect-sdk';
import { SolanaAddress } from './address';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

registerNative('Solana', SolanaAddress);

export type SolanaChainName = PlatformToChains<'Solana'>;
export type UniversalOrSolana = UniversalOrNative<'Solana'>;

export const toSolanaAddrString = (addr: UniversalOrSolana) =>
  typeof addr === 'string'
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative('Solana')
        : addr
      ).unwrap();
