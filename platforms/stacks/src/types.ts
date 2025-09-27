import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";

export const unusedNonce = 0;
export const unusedArbiterFee = 0n;

/**
 * Runtime value for the Stacks Platform
 */
export const _platform: 'Stacks' = 'Stacks';

/**
 * Type for the Stacks Platform
 */
export type StacksPlatformType = typeof _platform;

export type StacksChains = PlatformToChains<StacksPlatformType>
export type UniversalOrStacks = UniversalOrNative<StacksChains>
export type AnyStacksAddress = UniversalOrStacks | string | Uint8Array;
