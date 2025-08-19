// Covalent GoldRush indexer
// https://goldrush.dev/docs/api-reference/overview
//
// We don't use the official @covalenthq/client-sdk client for this because it's over 1MB and all we need
// is a small subset of one endpoint. This is how you know this code isn't AI slop.

import type {
  Balances,
  Chain,
  Network,
} from '@wormhole-foundation/sdk-connect';

const GOLD_RUSH_CHAINS: Record<Network, Partial<Record<Chain, string>>> = {
  Mainnet: {
    Ethereum: 'eth-mainnet',
    Polygon: 'matic-mainnet',
    Bsc: 'bsc-mainnet',
    Optimism: 'optimism-mainnet',
    Base: 'base-mainnet',
    Worldchain: 'world-mainnet',
    Sei: 'sei-mainnet',
    Ink: 'ink-mainnet',
    Solana: 'solana-mainnet',
    Arbitrum: 'arbitrum-mainnet',
    Berachain: 'berachain-mainnet',
    Linea: 'linea-mainnet',
    Scroll: 'scroll-mainnet',
    Seievm: 'sei-mainnet',
    Unichain: 'unichain-mainnet',
  },
  Testnet: {
    Ethereum: 'eth-sepolia',
    Polygon: 'polygon-amoy-testnet',
    Bsc: 'bsc-testnet',
    Optimism: 'optimism-sepolia',
    Base: 'base-sepolia-testnet',
    Worldchain: 'world-sepolia-testnet',
    Unichain: 'unichain-sepolia-testnet',
    Berachain: 'berachain-testnet',
    Ink: 'ink-sepolia-testnet',
    Arbitrum: 'arbitrum-sepolia',
    Linea: 'linea-sepolia-testnet',
    Scroll: 'scroll-sepolia-testnet',
  },
  Devnet: {},
};

export class GoldRushClient {
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
    if (!endpoint) throw new Error('Chain not supported by GoldRush indexer');

    let response: Response;
    try {
      response = await fetch(
        `https://api.covalenthq.com/v1/${endpoint}/address/${walletAddr}/balances_v2/?key=${this.key}`,
        { signal },
      );
    } catch (err) {
      throw new Error('GoldRush API error: ' + (err as Error).message);
    }

    if (!response.ok) {
      throw new Error(
        `GoldRush API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const { data } = await response.json();

    if (!data || !data.items) {
      throw new Error('Invalid response structure from GoldRush API');
    }

    const bals: Balances = {};
    for (let item of data.items) {
      const ca = item.contract_address.toLowerCase();
      // GoldRush uses this special address to represent native tokens
      const addr =
        ca === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 'native' : ca;

      // Only include tokens with non-zero balance
      const balance = BigInt(item.balance || '0');
      if (balance > 0n) {
        bals[addr] = balance;
      }
    }

    return bals;
  }
}

const ALCHEMY_CHAINS: Record<Network, Partial<Record<Chain, string>>> = {
  Mainnet: {
    Ethereum: 'eth-mainnet',
    Base: 'base-mainnet',
    Arbitrum: 'arb-mainnet',
    Optimism: 'opt-mainnet',
    Polygon: 'polygon-mainnet',
    Worldchain: 'worldchain-mainnet',
    Ink: 'ink-mainnet',
    Unichain: 'unichain-mainnet',
    Berachain: 'berachain-mainnet',
  },
  Testnet: {
    Ethereum: 'eth-sepolia',
    Base: 'base-sepolia',
    Arbitrum: 'arb-sepolia',
    Optimism: 'opt-sepolia',
    Polygon: 'polygon-amoy',
    Worldchain: 'worldchain-sepolia',
    Ink: 'ink-sepolia',
    Unichain: 'unichain-sepolia',
    Berachain: 'berachain-bartio',
    Monad: 'monad-testnet',
  },
  Devnet: {},
};

export class AlchemyClient {
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
    if (!endpoint) throw new Error('Chain not supported by Alchemy indexer');

    let response: Response;
    try {
      response = await fetch(
        `https://${endpoint}.g.alchemy.com/v2/${this.key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenBalances',
            params: [walletAddr, 'erc20'], // Use "erc20" to get all ERC-20 tokens
          }),
          signal,
        },
      );
    } catch (err) {
      throw new Error('Alchemy API error: ' + (err as Error).message);
    }

    if (!response.ok) {
      throw new Error(
        `Alchemy API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const { result } = await response.json();

    if (!result?.tokenBalances) {
      throw new Error('Invalid response structure from Alchemy API');
    }

    const bals: Balances = {};
    for (const item of result.tokenBalances) {
      // Skip if no contract address
      if (!item.contractAddress) continue;

      // Alchemy docs show "tokenBalance" but historically might have been "balance"
      // Support both for compatibility
      const balanceHex = item.tokenBalance || item.balance;
      if (!balanceHex || balanceHex === '0x0' || balanceHex === '0x') continue;

      try {
        const balance = BigInt(balanceHex);
        if (balance > 0n) {
          bals[item.contractAddress.toLowerCase()] = balance;
        }
      } catch (e) {
        console.warn(
          `Failed to parse balance for ${item.contractAddress}: ${balanceHex}`,
        );
      }
    }

    return bals;
  }
}
