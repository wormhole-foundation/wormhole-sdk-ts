import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/connect-sdk";

export const _platform: "Algorand" = "Algorand";
export type AlgorandPlatformType = typeof _platform;

export type AlgorandChains = PlatformToChains<AlgorandPlatformType>;
export type UniversalOrAlgorand = UniversalOrNative<AlgorandChains>;
export type AnyAlgorandAddress = UniversalOrAlgorand | string | Uint8Array;
