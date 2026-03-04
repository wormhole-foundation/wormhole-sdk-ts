import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";

/**
 * Runtime value for the Xrpl Platform
 */
export const _platform: "Xrpl" = "Xrpl";

/**
 * Type for the Xrpl Platform
 */
export type XrplPlatformType = typeof _platform;

export type XrplChains = PlatformToChains<XrplPlatformType>;
export type UniversalOrXrpl = UniversalOrNative<XrplChains>;
export type AnyXrplAddress = UniversalOrXrpl | string | Uint8Array;
