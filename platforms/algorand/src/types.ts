import {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type AlgorandChainName = PlatformToChains<'Algorand'>;
export type UniversalOrAlgorand = UniversalOrNative<'Algorand'>;
export type AnyAlgorandAddress = UniversalOrAlgorand | string | Uint8Array;
