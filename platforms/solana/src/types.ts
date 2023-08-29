import { PlatformToChains } from '@wormhole-foundation/sdk-base';
import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
} from '@wormhole-foundation/sdk-definitions';

//import { SolanaAddress } from './address';
//registerNative('Solana', SolanaAddress);

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type SolanaChainName = PlatformToChains<'Solana'>;
export type UniversalOrSolana = UniversalOrNative<'Solana'> | string;

export const toSolanaAddrString = (addr: UniversalOrSolana) =>
  typeof addr === 'string'
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative('Solana')
        : addr
      ).unwrap();
