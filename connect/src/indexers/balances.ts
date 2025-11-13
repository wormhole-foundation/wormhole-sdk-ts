import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { Balances } from "@wormhole-foundation/sdk-definitions";
import AlchemyClient from "./AlchemyClient.js";
import GoldRushClient from "./GoldRushClient.js";
import type { IndexerConfig, IndexerClientConfig } from "./types.js";

const DEFAULT_TIMEOUT_MS = 5000;

async function tryClient({
  client,
  network,
  chain,
  walletAddr,
  name,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: IndexerClientConfig): Promise<Balances | null> {
  if (!client) {
    return null;
  }

  try {
    if (!client.supportsChain(network, chain)) {
      console.info(`Network=${network} Chain=${chain} not supported by ${name} indexer API`);

      return null;
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort(new Error(`${name} request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let balances: Balances;

    try {
      balances = await client.getBalances(network, chain, walletAddr, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    return balances;
  } catch (e) {
    console.info(`Error querying ${name} indexer API: ${e}`);
    return null;
  }
}

export async function getWalletBalances(
  walletAddr: string,
  network: Network,
  chain: Chain,
  indexers?: IndexerConfig,
): Promise<Balances> {
  if (!indexers) {
    throw new Error("Can't get balances without an indexer.");
  }

  const { goldRush, alchemy } = indexers;
  const commonConfig = { network, chain, walletAddr };

  const clientConfigs: Array<IndexerClientConfig> = [
    {
      ...commonConfig,
      client: goldRush?.apiKey ? new GoldRushClient(goldRush.apiKey) : undefined,
      name: "Gold Rush",
      timeoutMs: goldRush?.timeoutMs,
    },
    {
      ...commonConfig,
      client: alchemy?.apiKey ? new AlchemyClient(alchemy.apiKey) : undefined,
      name: "Alchemy",
      timeoutMs: alchemy?.timeoutMs,
    },
  ];

  for (const config of clientConfigs) {
    const result = await tryClient(config);

    if (result) {
      return result;
    }
  }

  throw new Error("Failed to get a successful response from indexers");
}
