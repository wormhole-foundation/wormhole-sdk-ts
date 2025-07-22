import { PlatformToChains } from "@wormhole-foundation/sdk-connect";

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
// export type UniversalOrStacks = UniversalOrNative<StacksChains> FG TODO
export type AnyStacksAddress = string | Uint8Array;
