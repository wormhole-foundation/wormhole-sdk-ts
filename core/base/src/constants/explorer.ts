import { Chain } from "./chains";
import { Network, MAINNET, TESTNET, DEVNET } from "./networks";

type ExplorerSettings = {
  name: string;
  baseUrl: string;
  endpoints: {
    tx: string;
    account: string;
  };
  networkQuery?: {
    default: Network;
    Mainnet?: string;
    Devnet?: string;
    Testnet?: string;
  };
};

export const MAINNET_EXPLORER_CONFIG: {
  [chain in Chain]?: ExplorerSettings;
} = {
  Ethereum: {
    name: "Etherscan",
    baseUrl: "https://etherscan.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Solana: {
    name: "Solana Explorer",
    baseUrl: "https://explorer.solana.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Polygon: {
    name: "PolygonScan",
    baseUrl: "https://polygonscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Bsc: {
    name: "BscScan",
    baseUrl: "https://bscscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Avalanche: {
    name: "Snowtrace",
    baseUrl: "https://snowtrace.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Fantom: {
    name: "FTMscan",
    baseUrl: "https://ftmscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Celo: {
    name: "Celo Explorer",
    baseUrl: "https://explorer.celo.org/mainnet/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Moonbeam: {
    name: "Moonscan",
    baseUrl: "https://moonscan.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Sui: {
    name: "Sui Explorer",
    baseUrl: "https://explorer.sui.io/",
    endpoints: {
      tx: "txblock/",
      account: "address/",
    },
  },
  Aptos: {
    name: "Aptos Explorer",
    baseUrl: "https://explorer.aptoslabs.com/",
    endpoints: {
      tx: "txn/",
      account: "account/",
    },
  },
  Sei: {
    name: "Sei Explorer",
    baseUrl: "https://sei.explorers.guru/",
    endpoints: {
      tx: "transaction/",
      account: "address/",
    },
  },
};

export const TESTNET_EXPLORER_CONFIG: {
  [chain in Chain]?: ExplorerSettings;
} = {
  Ethereum: {
    name: "Etherscan",
    baseUrl: "https://goerli.etherscan.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Polygon: {
    name: "PolygonScan",
    baseUrl: "https://mumbai.polygonscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Bsc: {
    name: "BscScan",
    baseUrl: "https://testnet.bscscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Avalanche: {
    name: "Snowtrace",
    baseUrl: "https://testnet.snowtrace.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Fantom: {
    name: "FTMscan",
    baseUrl: "https://testnet.ftmscan.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Celo: {
    name: "Celo Explorer",
    baseUrl: "https://explorer.celo.org/alfajores/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Moonbeam: {
    name: "Moonscan",
    baseUrl: "https://moonbase.moonscan.io/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
  },
  Solana: {
    name: "Solana Explorer",
    baseUrl: "https://explorer.solana.com/",
    endpoints: {
      tx: "tx/",
      account: "address/",
    },
    networkQuery: {
      default: "Devnet",
      Testnet: "?cluster=testnet",
      Devnet: "?cluster=devnet",
    },
  },
  Sui: {
    name: "Sui Explorer",
    baseUrl: "https://explorer.sui.io/",
    endpoints: {
      tx: "txblock/",
      account: "address/",
    },
    networkQuery: {
      default: "Testnet",
      Testnet: "?network=testnet",
      Devnet: "?network=devnet",
    },
  },
  Aptos: {
    name: "Aptos Explorer",
    baseUrl: "https://explorer.aptoslabs.com/",
    endpoints: {
      tx: "txn/",
      account: "account/",
    },
    networkQuery: {
      default: "Testnet",
      Testnet: "?network=testnet",
      Devnet: "?network=devnet",
    },
  },
  Sei: {
    name: "Sei Explorer",
    baseUrl: "https://sei.explorers.guru/",
    endpoints: {
      tx: "transaction/",
      account: "address/",
    },
  },
};

export function linkToTx(
  chainName: Chain,
  txId: string,
  network: Network
): string {
  const explorerConfig =
    network == MAINNET ? MAINNET_EXPLORER_CONFIG : TESTNET_EXPLORER_CONFIG;
  const chainConfig = explorerConfig[chainName];
  if (!chainConfig) throw new Error("invalid chain, explorer config not found");
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery ? networkQuery[network] : "";
  return `${baseUrl}${endpoints.tx}${txId}${query}`;
}

export function linkToAccount(
  chainName: Chain,
  account: string,
  network: Network
): string {
  const explorerConfig =
    network === MAINNET ? MAINNET_EXPLORER_CONFIG : TESTNET_EXPLORER_CONFIG;
  const chainConfig = explorerConfig[chainName];
  if (!chainConfig) throw new Error("invalid chain, explorer config not found");
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery ? networkQuery[network] : "";
  return `${baseUrl}${endpoints.account}${account}${query}`;
}
