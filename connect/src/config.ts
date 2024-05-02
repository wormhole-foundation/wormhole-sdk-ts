import type { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import { circle } from "@wormhole-foundation/sdk-base";
import type { ChainConfig, ChainsConfig } from "@wormhole-foundation/sdk-definitions";
import { buildConfig } from "@wormhole-foundation/sdk-definitions";

export const DEFAULT_TASK_TIMEOUT = 60 * 1000; // 1 minute in milliseconds

export type WormholeConfig<N extends Network = Network, P extends Platform = Platform> = {
  api: string;
  circleAPI: string;
  chains: ChainsConfig<N, P>;
};

export const CONFIG = {
  Mainnet: {
    api: "https://api.wormholescan.io",
    circleAPI: circle.circleAPI("Mainnet"),
    chains: buildConfig("Mainnet"),
  },
  Testnet: {
    api: "https://api.testnet.wormholescan.io",
    circleAPI: circle.circleAPI("Testnet"),
    chains: buildConfig("Testnet"),
  },
  Devnet: {
    api: "http://guardian:7071", // Tilt Guardian REST api
    circleAPI: "",
    chains: buildConfig("Devnet"),
  },
} as const satisfies Record<Network, WormholeConfig>;

export function networkPlatformConfigs<N extends Network, P extends Platform>(
  network: N,
  platform: P,
): ChainsConfig<N, P> {
  return Object.fromEntries(
    Object.entries(CONFIG[network].chains).filter(([_, c]) => {
      return c.platform == platform;
    }),
  ) as ChainsConfig<N, P>;
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P];
};
export type WormholeConfigOverrides<N extends Network> = RecursivePartial<WormholeConfig<N>>;
export type ChainsConfigOverrides<N extends Network, P extends Platform> = RecursivePartial<
  ChainsConfig<N, P>
>;
export type ChainConfigOverrides<N extends Network, C extends Chain> = RecursivePartial<
  ChainConfig<N, C>
>;

// Apply any overrides to the base config
export function applyWormholeConfigOverrides<N extends Network>(
  network: N,
  overrides?: WormholeConfigOverrides<N>,
): WormholeConfig {
  let base = CONFIG[network];
  if (!overrides) return base;
  return override(base, overrides);
}

// Apply any overrides to the base config
export function applyChainsConfigConfigOverrides<N extends Network, P extends Platform>(
  network: N,
  platform: P,
  overrides?: ChainsConfigOverrides<N, P>,
): ChainsConfig<N, P> {
  const base = networkPlatformConfigs(network, platform);
  if (!overrides) return base;
  return override(base, overrides);
}

// recurse through the overrides and apply them to the base config
function override(base: any, overrides: any) {
  if (!base) base = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      base[key] = override(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

const inNode = typeof process !== "undefined";
export const DEFAULT_NETWORK: Network =
  (inNode && (process.env["NETWORK"] as Network)) || "Testnet";
