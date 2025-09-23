import type { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";

export const _platform: "Hyperliquid" = "Hyperliquid";
export type HyperliquidPlatformType = typeof _platform;

export type HyperliquidChains = PlatformToChains<HyperliquidPlatformType>;
export type UniversalOrHyperliquid = UniversalOrNative<HyperliquidChains>;
export type AnyHyperliquidAddress = UniversalOrHyperliquid | string | Uint8Array;

export type HyperliquidBuildOutput = {
  modules: string[];
  dependencies: string[];
};