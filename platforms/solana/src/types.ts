import {
  PlatformToChains,
  UniversalAddress,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type SolanaChainName = PlatformToChains<'Solana'>;
export type UniversalOrSolana = UniversalOrNative<'Solana'>;

export const toSolanaAddrString = (addr: UniversalOrSolana) =>
  typeof addr === 'string'
    ? addr
    : (addr instanceof UniversalAddress
        ? addr.toNative('Solana')
        : addr
      ).unwrap();
