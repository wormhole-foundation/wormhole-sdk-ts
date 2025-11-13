import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { Balances } from "@wormhole-foundation/sdk-definitions";
import { parseBalance } from "./utils.js";

const ALCHEMY_CHAINS: Record<Network, Partial<Record<Chain, string>>> = {
  Mainnet: {
    Ethereum: "eth-mainnet",
    Base: "base-mainnet",
    Arbitrum: "arb-mainnet",
    Optimism: "opt-mainnet",
    Polygon: "polygon-mainnet",
    Worldchain: "worldchain-mainnet",
    Ink: "ink-mainnet",
    Unichain: "unichain-mainnet",
    Berachain: "berachain-mainnet",
    Celo: "celo-mainnet",
    Linea: "linea-mainnet",
  },
  Testnet: {
    Ethereum: "eth-sepolia",
    Base: "base-sepolia",
    Arbitrum: "arb-sepolia",
    Optimism: "opt-sepolia",
    Polygon: "polygon-amoy",
    Worldchain: "worldchain-sepolia",
    Ink: "ink-sepolia",
    Unichain: "unichain-sepolia",
    Berachain: "berachain-bartio",
    Monad: "monad-testnet",
  },
  Devnet: {},
};

class AlchemyClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  supportsChain(network: Network, chain: Chain) {
    const endpoint = ALCHEMY_CHAINS[network][chain];
    return endpoint !== undefined;
  }

  async getBalances(
    network: Network,
    chain: Chain,
    walletAddr: string,
    signal?: AbortSignal,
  ): Promise<Balances> {
    const endpoint = ALCHEMY_CHAINS[network][chain];
    if (!endpoint) throw new Error("Chain not supported by Alchemy indexer");

    const { result } = await (
      await fetch(`https://${endpoint}.g.alchemy.com/v2/${this.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "alchemy_getTokenBalances",
          params: [walletAddr, "erc20"],
        }),
        signal,
      })
    ).json();

    const bals: Balances = {};

    for (let item of result.tokenBalances) {
      const bal = parseBalance(item.tokenBalance || item.balance);
      if (bal !== null) {
        bals[item.contractAddress] = bal;
      }
    }

    return bals;
  }
}

export default AlchemyClient;
