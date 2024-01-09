import { Network, circle, Platform } from "@wormhole-foundation/sdk-base";
import { buildConfig, ChainsConfig } from "@wormhole-foundation/sdk-definitions";

export const DEFAULT_TASK_TIMEOUT = 60 * 1000; // 1 minute in milliseconds

export type WormholeConfig<N extends Network = Network, P extends Platform = Platform> = {
  api: string;
  circleAPI: string;
  chains: ChainsConfig<N, P>;
};

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
    ? RecursivePartial<T[P]>
    : T[P];
};

export type ConfigOverrides = RecursivePartial<WormholeConfig>;

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

// Apply any overrides to the base config
export function applyOverrides<N extends Network>(
  network: N,
  overrides?: ConfigOverrides,
): WormholeConfig {
  let base = CONFIG[network];
  if (!overrides) return base;

  // recurse through the overrides and apply them to the base config
  function override(base: any, overrides: any) {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === "object" && !Array.isArray(value)) {
        base[key] = override(base[key], value);
      } else {
        base[key] = value;
      }
    }
    return base;
  }

  return override(base, overrides);
}

const inNode = typeof process !== "undefined";
export const DEFAULT_NETWORK: Network =
  (inNode && (process.env["NETWORK"] as Network)) || "Testnet";
