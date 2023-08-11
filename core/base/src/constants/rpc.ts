import { toMapping, toMappingFunc } from "../utils";
import { Network } from "./networks";
import { ChainName } from "./chains";

const rpcConfig = [
  [
    "Mainnet",
    [
      ["Ethereum", "https://rpc.ankr.com/eth"],
      ["Solana", "https://api.mainnet-beta.solana.com"],
      ["Polygon", "https://rpc.ankr.com/polygon"],
      ["Bsc", "https://bscrpc.com"],
      ["Avalanche", "https://rpc.ankr.com/avalanche"],
      ["Fantom", "https://rpc.ankr.com/fantom"],
      ["Celo", "https://rpc.ankr.com/celo"],
      ["Moonbeam", "https://rpc.ankr.com/moonbeam"],
      ["Sui", "https://rpc.mainnet.sui.io"],
      ["Aptos", "https://fullnode.mainnet.aptoslabs.com/v1"],
      ["Sei", ""], // TODO
    ],
  ],
  [
    "Testnet",
    [
      ["Ethereum", "https://rpc.ankr.com/eth_goerli"],
      ["Polygon", "https://polygon-mumbai.blockpi.network/v1/rpc/public"],
      ["Bsc", "https://data-seed-prebsc-1-s3.binance.org:8545"],
      ["Avalanche", "https://api.avax-test.network/ext/bc/C/rpc"],
      ["Fantom", "https://rpc.ankr.com/fantom_testnet"],
      ["Celo", "https://alfajores-forno.celo-testnet.org"],
      ["Solana", "https://api.devnet.solana.com"],
      ["Moonbeam", "https://rpc.api.moonbase.moonbeam.network"],
      ["Sui", "https://fullnode.testnet.sui.io"],
      ["Aptos", "https://fullnode.testnet.aptoslabs.com/v1"],
      ["Sei", "https://rpc.atlantic-2.seinetwork.io"],
    ],
  ],
  ["Devnet", []],
] as const satisfies readonly (readonly [
  Network,
  readonly (readonly [ChainName, string])[]
])[];

export const rpcs = {
  Mainnet: toMapping(rpcConfig[0][1]),
  Testnet: toMapping(rpcConfig[1][1]),
  Devnet: toMapping(rpcConfig[2][1]),
};

export const rpcAddress = toMappingFunc(rpcs);
