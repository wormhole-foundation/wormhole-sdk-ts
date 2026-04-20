import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type AlchemyClient from "./AlchemyClient.js";
import type GoldRushClient from "./GoldRushClient.js";

export interface IndexerConfig {
  goldRush?: {
    /** API key for direct GoldRush/Covalent access. Not needed when `url` is set. */
    apiKey?: string;
    /** Custom base URL (e.g. a proxy that injects the key server-side).
     *  When set, requests go to `${url}/v1/{chain}/…` with no key param. */
    url?: string;
    timeoutMs: number;
  };
  alchemy?: {
    /** API key for direct Alchemy access. Not needed when `url` is set. */
    apiKey?: string;
    /** Custom base URL (e.g. a proxy that injects the key server-side).
     *  When set, requests go to `${url}/{chain}` with no key in the path. */
    url?: string;
    timeoutMs: number;
  };
}

export interface IndexerClientConfig {
  chain: Chain;
  client?: GoldRushClient | AlchemyClient;
  name: string;
  network: Network;
  timeoutMs?: number;
  walletAddr: string;
}
