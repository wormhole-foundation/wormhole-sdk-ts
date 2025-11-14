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

const RPC_ID_TOKEN_BALANCES = 1;
const RPC_ID_NATIVE_BALANCE = 2;

class AlchemyClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  supportsChain(network: Network, chain: Chain) {
    const endpoint = ALCHEMY_CHAINS[network][chain];
    return endpoint !== undefined;
  }

  private async batchFetchFromAlchemy(
    endpoint: string,
    requests: Array<{ method: string; params: any[]; id: number }>,
    signal?: AbortSignal,
  ): Promise<Array<{ id: number; result: any }>> {
    const baseUrl = `https://${endpoint}.g.alchemy.com/v2/${this.key}`;

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        requests.map((req) => ({
          jsonrpc: "2.0",
          id: req.id,
          method: req.method,
          params: req.params,
        })),
      ),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Alchemy API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  private parseEthTokenResponse(tokenBalances: any[], bals: Balances): void {
    for (let item of tokenBalances) {
      const bal = parseBalance(item.tokenBalance || item.balance);
      if (bal !== null) {
        bals[item.contractAddress] = bal;
      }
    }
  }

  private parseEthNativeResponse(nativeBalance: string, bals: Balances): void {
    const nativeBal = parseBalance(nativeBalance);
    if (nativeBal !== null) {
      bals.native = nativeBal;
    }
  }

  async getBalances(
    network: Network,
    chain: Chain,
    walletAddr: string,
    signal?: AbortSignal,
  ): Promise<Balances> {
    const endpoint = ALCHEMY_CHAINS[network][chain];

    if (!endpoint) {
      throw new Error("Chain not supported by Alchemy indexer");
    }

    const responses = await this.batchFetchFromAlchemy(
      endpoint,
      [
        {
          method: "alchemy_getTokenBalances",
          params: [walletAddr, "erc20"],
          id: RPC_ID_TOKEN_BALANCES,
        },
        { method: "eth_getBalance", params: [walletAddr, "latest"], id: RPC_ID_NATIVE_BALANCE },
      ],
      signal,
    );

    const bals: Balances = {};

    for (const response of responses) {
      if (!response) {
        continue;
      }

      if (response.id === RPC_ID_TOKEN_BALANCES && response.result?.tokenBalances) {
        this.parseEthTokenResponse(response.result.tokenBalances, bals);
      } else if (response.id === RPC_ID_NATIVE_BALANCE && response.result) {
        this.parseEthNativeResponse(response.result, bals);
      }
    }

    return bals;
  }
}

export default AlchemyClient;
