import {
  UniversalOrNative,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';

export type AlgorandChainName = PlatformToChains<'Algorand'>;
export type UniversalOrAlgorand = UniversalOrNative<'Algorand'>;
export type AnyAlgorandAddress =
  | UniversalOrAlgorand
  | string
  | number
  | bigint
  | Uint8Array;
