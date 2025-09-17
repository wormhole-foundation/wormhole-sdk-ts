import type { MapLevels } from './../utils/index.js';
import { constMap } from './../utils/index.js';
import type { Network } from './networks.js';
import type { Chain } from './chains.js';

export type ExplorerSettings = {
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

const explorerConfig = [[
  "Mainnet", [[
    "Ethereum", {
      name: "Etherscan",
      baseUrl: "https://etherscan.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Solana", {
      name: "Solana Explorer",
      baseUrl: "https://explorer.solana.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Polygon", {
      name: "PolygonScan",
      baseUrl: "https://polygonscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Bsc", {
      name: "BscScan",
      baseUrl: "https://bscscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Avalanche", {
      name: "Snowtrace",
      baseUrl: "https://snowtrace.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Fantom", {
      name: "FTMscan",
      baseUrl: "https://ftmscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Celo", {
      name: "Celo Explorer",
      baseUrl: "https://explorer.celo.org/mainnet/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Moonbeam", {
      name: "Moonscan",
      baseUrl: "https://moonscan.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Sui", {
      name: "Sui Explorer",
      baseUrl: "https://explorer.sui.io/",
      endpoints: {
        tx: "txblock/",
        account: "address/",
      },
    }], [
    "Aptos", {
      name: "Aptos Explorer",
      baseUrl: "https://explorer.aptoslabs.com/",
      endpoints: {
        tx: "txn/",
        account: "account/",
      },
    }], [
    "Sei", {
      name: "Sei Explorer",
      baseUrl: "https://sei.explorers.guru/",
      endpoints: {
        tx: "transaction/",
        account: "address/",
      },
    }], [
    "Mezo", {
      name: "Mezo Explorer",
      baseUrl: "https://explorer.mezo.org/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "HyperEVM", {
      name: "HyperEVMScan",
      baseUrl: "https://hyperevmscan.io/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "XRPLEVM", {
      name: "XRPL Explorer",
      baseUrl: "https://explorer.xrplevm.org/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "Plume", {
      name: "Plume Explorer",
      baseUrl: "https://explorer.plume.org",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "CreditCoin", {
      name: "CreditCoin Explorer",
      baseUrl: "https://creditcoin.blockscout.com/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }],
  ]], [
  "Testnet", [[
    "Ethereum", {
      name: "Etherscan",
      baseUrl: "https://goerli.etherscan.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Polygon", {
      name: "PolygonScan",
      baseUrl: "https://mumbai.polygonscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Bsc", {
      name: "BscScan",
      baseUrl: "https://testnet.bscscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Avalanche", {
      name: "Snowtrace",
      baseUrl: "https://testnet.snowtrace.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Fantom", {
      name: "FTMscan",
      baseUrl: "https://testnet.ftmscan.com/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Celo", {
      name: "Celo Explorer",
      baseUrl: "https://explorer.celo.org/alfajores/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Moonbeam", {
      name: "Moonscan",
      baseUrl: "https://moonbase.moonscan.io/",
      endpoints: {
        tx: "tx/",
        account: "address/",
      },
    }], [
    "Solana", {
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
    }], [
    "Sui", {
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
    }], [
    "Aptos", {
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
    }], [
    "Sei", {
      name: "Sei Explorer",
      baseUrl: "https://sei.explorers.guru/",
      endpoints: {
        tx: "transaction/",
        account: "address/",
      },
    }], [
    "Mezo", {
      name: "Mezo Explorer",
      baseUrl: "https://explorer.test.mezo.org/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "XRPLEVM", {
      name: "XRPL Explorer",
      baseUrl: "https://explorer.testnet.xrplevm.org/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "Plume", {
      name: "Plume Explorer",
      baseUrl: "https://testnet-explorer.plume.org/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }], [
    "CreditCoin", {
      name: "CreditCoin Explorer",
      baseUrl: "https://creditcoin-testnet.blockscout.com/",
      endpoints: {
        tx: "tx/",
        account: "address/"
      },
    }]
  ]],
] as const satisfies MapLevels<["Mainnet" | "Testnet", Chain, ExplorerSettings]>;

export const explorerConfs = constMap(explorerConfig);

export const explorerConfigs = (network: Network, chain: Chain) =>
  network === "Devnet" ? undefined : (explorerConfs.get(network, chain) as ExplorerSettings);

export function linkToTx(chainName: Chain, txId: string, network: Network): string {
  // TODO: add missing chains to rpc config
  const chainConfig = explorerConfigs(network, chainName);
  if (!chainConfig) throw new Error("invalid chain, explorer config not found");
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery ? networkQuery[network] : "";
  return `${baseUrl}${endpoints.tx}${txId}${query}`;
}

export function linkToAccount(chainName: Chain, account: string, network: Network): string {
  // TODO: add missing chains to rpc config
  const chainConfig = explorerConfigs(network, chainName);
  if (!chainConfig) throw new Error("invalid chain, explorer config not found");
  const { baseUrl, endpoints, networkQuery } = chainConfig;
  const query = networkQuery ? networkQuery[network] : "";
  return `${baseUrl}${endpoints.account}${account}${query}`;
}
