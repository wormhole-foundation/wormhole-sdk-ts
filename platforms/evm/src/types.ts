import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
  PlatformToChains,
} from '@wormhole-foundation/connect-sdk';
import { TransactionRequest } from 'ethers';

import { EvmAddress } from './address';

registerNative('Evm', EvmAddress);

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type EvmChainName = PlatformToChains<'Evm'>;
export type UniversalOrEvm = UniversalOrNative<'Evm'>;
export type AnyEvmAddress = UniversalOrEvm | string;

export const toEvmAddrString = (addr: AnyEvmAddress) =>
  typeof addr === 'string'
    ? addr
    : (addr instanceof UniversalAddress ? addr.toNative('Evm') : addr).unwrap();

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
