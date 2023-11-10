import {
  UniversalOrNative,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';
import { TransactionRequest } from 'ethers';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type EvmChains = PlatformToChains<'Evm'>;
export type UniversalOrEvm = UniversalOrNative<'Evm'>;
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
