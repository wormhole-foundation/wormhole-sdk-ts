import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type AlchemyClient from "./AlchemyClient.js";
import type GoldRushClient from "./GoldRushClient.js";

export interface IndexerConfig {
  goldRush?: {
    apiKey: string;
    timeoutMs: number;
  };
  alchemy?: {
    apiKey: string;
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
