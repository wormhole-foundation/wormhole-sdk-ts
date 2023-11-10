import { Network, circleAPI, PlatformName } from "@wormhole-foundation/sdk-base";
import { WormholeConfig } from "./types";
import { buildConfig, ChainsConfig } from "@wormhole-foundation/sdk-definitions";

export const DEFAULT_TASK_TIMEOUT = 60 * 1000; // 1 minute in milliseconds

export const CIRCLE_RETRY_INTERVAL = 2000;
export const WHSCAN_RETRY_INTERVAL = 2000;

export const CONFIG = {
  Mainnet: {
    api: "https://api.wormholescan.io",
    circleAPI: circleAPI("Mainnet"),
    chains: buildConfig("Mainnet"),
  },
  Testnet: {
    api: "https://api.testnet.wormholescan.io",
    circleAPI: circleAPI("Testnet"),
    chains: buildConfig("Testnet"),
  },
  Devnet: {
    api: "http://guardian:7071", // Tilt Guardian REST api
    circleAPI: "",
    chains: buildConfig("Devnet"),
  },
} as const satisfies Record<Network, WormholeConfig>;

export function networkPlatformConfigs(network: Network, platform: PlatformName): ChainsConfig {
  return Object.fromEntries(
    Object.entries(CONFIG[network].chains).filter(([_, v]) => {
      return v.platform == platform;
    }),
  );
}

const inNode = typeof process !== "undefined";
export const DEFAULT_NETWORK: Network =
  (inNode && (process.env["NETWORK"] as Network)) || "Testnet";
