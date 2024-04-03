import type { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";

/**
 * Runtime value for the Cosmwasm Platform
 */
export const _platform: "Cosmwasm" = "Cosmwasm";
/**
 * Compile time type for Cosmwasm Platform
 */
export type CosmwasmPlatformType = typeof _platform;

export type CosmwasmChains = PlatformToChains<CosmwasmPlatformType>;
export type UniversalOrCosmwasm = UniversalOrNative<CosmwasmChains>;
export type AnyCosmwasmAddress = UniversalOrCosmwasm | string | Uint8Array;

export interface WrappedRegistryResponse {
  address: string;
}
