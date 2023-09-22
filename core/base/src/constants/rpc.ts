import { constMap, RoArray } from "../utils";
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
      ["Arbitrum", "https://arb1.arbitrum.io/rpc"],
      ["Optimism", "https://mainnet.optimism.io"],
      ["Sei", ""], // TODO

      ["Terra", ""],
      ["Terra2", ""],
      ["Injective", ""],
      ["Xpla", ""],
      ["Wormchain", ""],

      ["Osmosis", "https://osmosis-rpc.polkachu.com"],
      ["Cosmoshub", "https://cosmos-rpc.polkachu.com"],
      ["Evmos", "https://evmos-rpc.polkachu.com"],
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
      ["Arbitrum", "https://arbitrum-goerli.publicnode.com"],
      ["Optimism", "https://optimism-goerli.publicnode.com"],
      ["Terra", ""],
      ["Terra2", ""],
      ["Injective", ""],
      ["Xpla", ""],
      ["Wormchain", ""],
      ["Osmosis", "https://rpc.osmotest5.osmosis.zone"],
      ["Cosmoshub", "https://rpc.sentry-02.theta-testnet.polypore.xyz"],
      ["Evmos", "https://evmos-testnet-rpc.polkachu.com"],
    ],
  ],
] as const satisfies RoArray<
  readonly ["Mainnet" | "Testnet", RoArray<readonly [ChainName, string]>]
>;

const rpc = constMap(rpcConfig);
export const rpcAddress = (network: Network, chain: ChainName) =>
  network === "Devnet" ? undefined : rpc.get(network, chain);
