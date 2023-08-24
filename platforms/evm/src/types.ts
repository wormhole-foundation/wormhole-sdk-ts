import { PlatformToChains } from '@wormhole-foundation/sdk-base';
import {
  UniversalAddress,
  UniversalOrNative,
  registerNative,
} from '@wormhole-foundation/sdk-definitions';
import { TransactionRequest } from 'ethers';

import { EvmAddress } from './address';

registerNative('Evm', EvmAddress);

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

export type EvmChainName = PlatformToChains<'Evm'>;
export type UniversalOrEvm = UniversalOrNative<'Evm'> | string;

export const toEvmAddrString = (addr: UniversalOrEvm) =>
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
