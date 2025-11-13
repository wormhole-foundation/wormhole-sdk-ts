// Covalent GoldRush indexer
// https://goldrush.dev/docs/api-reference/overview
//
// We don't use the official @covalenthq/client-sdk client for this because it's over 1MB and all we need
// is a small subset of one endpoint. This is how you know this code isn't AI slop.

import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { Balances } from "@wormhole-foundation/sdk-definitions";
import { parseBalance } from "./utils.js";

const GOLD_RUSH_CHAINS: Record<Network, Partial<Record<Chain, string>>> = {
  Mainnet: {
    Ethereum: "eth-mainnet",
    Polygon: "matic-mainnet",
    Bsc: "bsc-mainnet",
    Optimism: "optimism-mainnet",
    Base: "base-mainnet",
    Worldchain: "world-mainnet",
    Sei: "sei-mainnet",
    Ink: "ink-mainnet",
    Solana: "solana-mainnet",
    Arbitrum: "arbitrum-mainnet",
    Berachain: "berachain-mainnet",
    Linea: "linea-mainnet",
    Scroll: "scroll-mainnet",
    Seievm: "sei-mainnet",
    Unichain: "unichain-mainnet",
    HyperEVM: "hyperevm-mainnet",
    Moonbeam: "moonbeam-mainnet",
    Mantle: "mantle-mainnet",
    Celo: "celo-mainnet",
    Fantom: "fantom-mainnet",
  },
  Testnet: {
    Ethereum: "eth-sepolia",
    Polygon: "polygon-amoy-testnet",
    Bsc: "bsc-testnet",
    Optimism: "optimism-sepolia",
    Base: "base-sepolia-testnet",
    Worldchain: "world-sepolia-testnet",
    Unichain: "unichain-sepolia-testnet",
    Berachain: "berachain-testnet",
    Ink: "ink-sepolia-testnet",
    Arbitrum: "arbitrum-sepolia",
    Linea: "linea-sepolia-testnet",
    Scroll: "scroll-sepolia-testnet",
    Monad: "monad-testnet",
    Mantle: "mantle-sepolia-testnet",
    Fantom: "fantom-testnet",
  },
  Devnet: {},
};

class GoldRushClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  supportsChain(network: Network, chain: Chain) {
    const endpoint = GOLD_RUSH_CHAINS[network][chain];
    return endpoint !== undefined;
  }

  async getBalances(
    network: Network,
    chain: Chain,
    walletAddr: string,
    signal?: AbortSignal,
  ): Promise<Balances> {
    const endpoint = GOLD_RUSH_CHAINS[network][chain];

    if (!endpoint) {
      throw new Error("Chain not supported by GoldRush indexer");
    }

    const { data } = await (
      await fetch(
        `https://api.covalenthq.com/v1/${endpoint}/address/${walletAddr}/balances_v2/?key=${this.key}`,
        { signal },
      )
    ).json();

    const bals: Balances = {};

    for (let item of data.items) {
      const ca = item.contract_address.toLowerCase();

      // GoldRush uses this special address to represent native tokens
      const addr = ca === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ? "native" : ca;

      const bal = parseBalance(item.balance);

      if (bal !== null) {
        bals[addr] = bal;
      }
    }

    return bals;
  }
}

export default GoldRushClient;
