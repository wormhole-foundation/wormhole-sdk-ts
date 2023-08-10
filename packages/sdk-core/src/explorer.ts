import { ChainName, Network } from './types.js';

type ExplorerSettings = {
  name: string;
  baseUrl: string;
  endpoints: {
    tx: string;
    account: string;
  };
  networkQuery?: {
    default: 'mainnet' | 'devnet' | 'testnet';
    mainnet?: string;
    devnet?: string;
    testnet?: string;
  };
};

export const MAINNET_EXPLORER_CONFIG: {
  [chain in ChainName]?: ExplorerSettings;
} = {
  ethereum: {
    name: 'Etherscan',
    baseUrl: 'https://etherscan.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  solana: {
    name: 'Solana Explorer',
    baseUrl: 'https://explorer.solana.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  polygon: {
    name: 'PolygonScan',
    baseUrl: 'https://polygonscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  bsc: {
    name: 'BscScan',
    baseUrl: 'https://bscscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  avalanche: {
    name: 'Snowtrace',
    baseUrl: 'https://snowtrace.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  fantom: {
    name: 'FTMscan',
    baseUrl: 'https://ftmscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  celo: {
    name: 'Celo Explorer',
    baseUrl: 'https://explorer.celo.org/mainnet/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  moonbeam: {
    name: 'Moonscan',
    baseUrl: 'https://moonscan.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  sui: {
    name: 'Sui Explorer',
    baseUrl: 'https://explorer.sui.io/',
    endpoints: {
      tx: 'txblock/',
      account: 'address/',
    },
  },
  aptos: {
    name: 'Aptos Explorer',
    baseUrl: 'https://explorer.aptoslabs.com/',
    endpoints: {
      tx: 'txn/',
      account: 'account/',
    },
  },
  sei: {
    name: 'Sei Explorer',
    baseUrl: 'https://sei.explorers.guru/',
    endpoints: {
      tx: 'transaction/',
      account: 'address/',
    },
  },
};

export const TESTNET_EXPLORER_CONFIG: {
  [chain in ChainName]?: ExplorerSettings;
} = {
  goerli: {
    name: 'Etherscan',
    baseUrl: 'https://goerli.etherscan.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  mumbai: {
    name: 'PolygonScan',
    baseUrl: 'https://mumbai.polygonscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  bsc: {
    name: 'BscScan',
    baseUrl: 'https://testnet.bscscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  fuji: {
    name: 'Snowtrace',
    baseUrl: 'https://testnet.snowtrace.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  fantom: {
    name: 'FTMscan',
    baseUrl: 'https://testnet.ftmscan.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  alfajores: {
    name: 'Celo Explorer',
    baseUrl: 'https://explorer.celo.org/alfajores/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  moonbasealpha: {
    name: 'Moonscan',
    baseUrl: 'https://moonbase.moonscan.io/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
  },
  solana: {
    name: 'Solana Explorer',
    baseUrl: 'https://explorer.solana.com/',
    endpoints: {
      tx: 'tx/',
      account: 'address/',
    },
    networkQuery: {
      default: 'devnet',
      testnet: '?cluster=testnet',
      devnet: '?cluster=devnet',
    },
  },
  sui: {
    name: 'Sui Explorer',
    baseUrl: 'https://explorer.sui.io/',
    endpoints: {
      tx: 'txblock/',
      account: 'address/',
    },
    networkQuery: {
      default: 'testnet',
      testnet: '?network=testnet',
      devnet: '?network=devnet',
    },
  },
  aptos: {
    name: 'Aptos Explorer',
    baseUrl: 'https://explorer.aptoslabs.com/',
    endpoints: {
      tx: 'txn/',
      account: 'account/',
    },
    networkQuery: {
      default: 'testnet',
      testnet: '?network=testnet',
      devnet: '?network=devnet',
    },
  },
  sei: {
    name: 'Sei Explorer',
    baseUrl: 'https://sei.explorers.guru/',
    endpoints: {
      tx: 'transaction/',
      account: 'address/',
    },
  },
};

export function linkToTx(
  chainName: ChainName,
  txId: string,
  network: Network,
): string {
  const explorerConfig =
    network === Network.MAINNET
      ? MAINNET_EXPLORER_CONFIG
      : TESTNET_EXPLORER_CONFIG;
  const chainConfig = explorerConfig[chainName];
  if (!chainConfig) throw new Error('invalid chain, explorer config not found');
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery
    ? networkQuery[network as 'mainnet' | 'devnet' | 'testnet']
    : '';
  return `${baseUrl}${endpoints.tx}${txId}${query}`;
}

export function linkToAccount(
  chainName: ChainName,
  account: string,
  network: Network,
): string {
  const explorerConfig =
    network === Network.MAINNET
      ? MAINNET_EXPLORER_CONFIG
      : TESTNET_EXPLORER_CONFIG;
  const chainConfig = explorerConfig[chainName];
  if (!chainConfig) throw new Error('invalid chain, explorer config not found');
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery
    ? networkQuery[network as 'mainnet' | 'devnet' | 'testnet']
    : '';
  return `${baseUrl}${endpoints.account}${account}${query}`;
}
