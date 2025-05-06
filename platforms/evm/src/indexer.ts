// Covalent GoldRush indexer
// https://goldrush.dev/docs/api-reference/overview
//
// We don't use the official @covalenthq/client-sdk client for this because it's over 1MB and all we need
// is a small subset of one endpoint. This is how you know this code isn't AI slop.

import { Balances, Chain, Network } from "@wormhole-foundation/sdk-connect";

const GOLDRUSH_CHAINS: Record<Network, Partial<Record<Chain, string>>> = {
  Mainnet: {
    Ethereum: 'eth-mainnet',
  },
  Testnet: {
    Ethereum: 'eth-sepolia',
  },
  Devnet: {},
}

export class GoldRushClient {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  supportsChain(network: Network, chain: Chain) {
    const endpoint = GOLDRUSH_CHAINS[network][chain];
    return endpoint !== undefined;
  }

  async getBalances(network: Network, chain: Chain, walletAddr: string): Promise<Balances> {
    const endpoint = GOLDRUSH_CHAINS[network][chain];
    if (!endpoint) throw new Error('Chain not supported by GoldRush indexer');

    const { data } = await (await fetch(`https://api.covalenthq.com/v1/${endpoint}/address/${walletAddr}/balances_v2/?key=${this.key}`)).json();

    const bals: Balances = {};
    for (let item of data.items) {
      bals[item.contract_address] = BigInt(item.balance);
    }

    return bals;
  }
}
