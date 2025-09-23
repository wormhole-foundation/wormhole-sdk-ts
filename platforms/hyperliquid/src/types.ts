import type { Network, PlatformContext, UniversalAddress } from "@wormhole-foundation/sdk-connect";

export const _platform = "HyperLiquid";
export type HyperliquidPlatform = typeof _platform;

export const _network: Network = "Mainnet";

export type AnyHyperliquidAddress = HyperliquidAddress | string | Uint8Array | UniversalAddress;

export interface HyperliquidPlatformContext
  extends PlatformContext<typeof _network, HyperliquidPlatform> {}

import type { HyperliquidAddress } from "./address.js";
