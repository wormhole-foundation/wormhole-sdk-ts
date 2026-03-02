import type { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";

/**
 * Runtime value for the Btc Platform
 */ 
export const _platform: "Btc" = "Btc";

/**
 * Type for the Btc Platform
 */
export type BtcPlatformType = typeof _platform;

export type BtcChains = PlatformToChains<BtcPlatformType>;
export type UniversalOrBtc = UniversalOrNative<BtcChains>;
export type AnyBtcAddress = UniversalOrBtc | string | Uint8Array;
