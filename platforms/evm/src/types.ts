import type {
  PlatformToChains,
  UniversalOrNative,
} from '@wormhole-foundation/sdk-connect';
import type { TransactionRequest } from 'ethers';

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

/**
 * Runtime value for the EVM Platform
 * */
export const _platform: 'Evm' = 'Evm';

/**
 * Type for the EVM Platform
 */
export type EvmPlatformType = typeof _platform;

/**
 * Type representing a union of the EVM Chains
 */
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
