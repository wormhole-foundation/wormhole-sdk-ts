import {
  UniversalOrNative,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';
import { TransactionRequest } from 'ethers';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

// TODO: can we specify this in 1 place and re-use it everywhere?
const EvmPlatformValue = 'Evm';
export type EvmPlatformType = typeof EvmPlatformValue;
export type EvmChains<P extends EvmPlatformType = EvmPlatformType> =
  PlatformToChains<P>;
export type UniversalOrEvm<P extends EvmPlatformType = EvmPlatformType> =
  UniversalOrNative<P>;
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
