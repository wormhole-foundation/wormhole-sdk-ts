import {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';
import { TransactionRequest } from 'ethers';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

// TODO: can we specify this in 1 place and re-use it everywhere?
export const _platform: 'Evm' = 'Evm';
export type EvmPlatformType = typeof _platform;

export type EvmChains = PlatformToChains<EvmPlatformType>;
export type UniversalOrEvm = UniversalOrNative<EvmChains>;
export type AnyEvmAddress = UniversalOrEvm | string | Uint8Array;

export const addFrom = (txReq: TransactionRequest, from: string) => ({
  ...txReq,
  from,
});
export const addChainId = (txReq: TransactionRequest, chainId: bigint) => ({
  ...txReq,
  chainId,
});
export const addValue = (txReq: TransactionRequest, value: bigint) => ({
  ...txReq,
  value,
});
