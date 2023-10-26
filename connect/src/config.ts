import {
  Network,
  ChainName,
  chains,
  chainToPlatform,
  explorerConfigs,
  finalityThreshold,
  nativeDecimals,
  rpcAddress,
  RoArray,
  constMap,
  circleAPI,
  PlatformName,
  blockTime,
} from "@wormhole-foundation/sdk-base";
import { WormholeConfig } from "./types";
import {
  getContracts,
  ChainConfig,
  ChainsConfig,
} from "@wormhole-foundation/sdk-definitions";

export const DEFAULT_TASK_TIMEOUT = 60 * 1000; // 1 minute in milliseconds

export const CIRCLE_RETRY_INTERVAL = 2000;
export const WHSCAN_RETRY_INTERVAL = 2000;

// TODO: add missing chains for each config
function combineConfig(n: Network): ChainsConfig {
  const cc: ChainsConfig = chains
    .map((c: ChainName): ChainConfig => {
      const platform = chainToPlatform(c);
      return {
        key: c,
        platform,
        network: n,
        finalityThreshold: finalityThreshold.get(n, c) || 0,
        blockTime: blockTime(c),
        contracts: getContracts(n, c),
        nativeTokenDecimals: nativeDecimals.get(platform)!, //TODO the exclamation mark is a lie
        explorer: explorerConfigs(n, c)!, //TODO the exclamation mark is a lie
        rpc: rpcAddress(n, c)!, //TODO the exclamation mark is a lie
      };
    })
    .reduce((acc, curr) => {
      return { ...acc, [curr.key]: curr };
    }, {});

  return cc;
}

// Combine all the configs for each network/chain
const chainConfigMapping = [
  ["Mainnet", combineConfig("Mainnet")],
  ["Testnet", combineConfig("Testnet")],
  ["Devnet", combineConfig("Devnet")],
] as const satisfies RoArray<readonly [Network, ChainsConfig]>;

export const chainConfigs = constMap(chainConfigMapping);

export function networkPlatformConfigs(
  network: Network,
  platform: PlatformName,
): ChainsConfig {
  return Object.fromEntries(
    Object.entries(chainConfigs(network)).filter(([_, v]) => {
      return v.platform == platform;
    }),
  );
}

export const CONFIG = {
  Mainnet: {
    api: "https://api.wormholescan.io",
    circleAPI: circleAPI("Mainnet"),
    chains: chainConfigs("Mainnet"),
  },
  Testnet: {
    api: "https://api.testnet.wormholescan.io",
    circleAPI: circleAPI("Testnet"),
    chains: chainConfigs("Testnet"),
  },
  Devnet: {
    api: "http://guardian:7071", // Tilt Guardian REST api
    circleAPI: "",
    chains: chainConfigs("Devnet"),
  },
} as const satisfies Record<Network, WormholeConfig>;

export const DEFAULT_NETWORK: Network =
  (process?.env?.NETWORK as Network) || "Testnet";
