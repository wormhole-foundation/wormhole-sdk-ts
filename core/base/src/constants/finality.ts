import { Network } from "./networks";
import { ChainName } from "./chains";
import { constMap, RoArray } from "../utils";

// Number of blocks before a transaction is considered final
const shareFinalities = [
  ["Ethereum", 64],
  ["Sepolia", 64],
  ["Solana", 32],
  ["Polygon", 64], // Note this is faster on !Mainnet currently but only because of guardian settings
  ["Bsc", 15],
  ["Avalanche", 1],
  ["Fantom", 1],
  ["Celo", 1],
  ["Moonbeam", 1],
  ["Sui", 0],
  ["Aptos", 0],
  ["Sei", 0],
  ["Algorand", 0],
] as const;

const finalityThresholds = [
  [
    "Mainnet",
    [
      ["Ethereum", 64],
      ["Solana", 32],
      ["Polygon", 512],
      ["Bsc", 15],
      ["Avalanche", 1],
      ["Fantom", 1],
      ["Celo", 1],
      ["Moonbeam", 1],
      ["Sui", 0],
      ["Aptos", 0],
      ["Sei", 0],
    ],
  ],
  ["Testnet", shareFinalities],
  ["Devnet", shareFinalities],
] as const satisfies RoArray<readonly [Network, RoArray<readonly [ChainName, number]>]>;

export const finalityThreshold = constMap(finalityThresholds);

// number of milliseconds between blocks
const blockTimeMilliseconds = [
  ["Acala", 12000],
  ["Algorand", 3300],
  ["Aptos", 4000],
  ["Arbitrum", 300],
  ["Aurora", 3000],
  ["Avalanche", 2000],
  ["Base", 2000],
  ["Bsc", 3000],
  ["Celo", 5000],
  ["Cosmoshub", 5000],
  ["Ethereum", 15000],
  ["Evmos", 2000],
  ["Fantom", 2500],
  ["Gnosis", 5000],
  ["Injective", 2500],
  ["Karura", 12000],
  ["Klaytn", 1000],
  ["Kujira", 3000],
  ["Moonbeam", 12000],
  ["Near", 1500],
  ["Neon", 30000],
  ["Oasis", 6000],
  ["Optimism", 2000],
  ["Osmosis", 6000],
  ["Polygon", 2000],
  ["Rootstock", 30000],
  ["Sei", 400],
  ["Sepolia", 15000],
  ["Solana", 400],
  ["Sui", 3000],
  ["Terra", 6000],
  ["Terra2", 6000],
  ["Xpla", 5000],
  ["Wormchain", 5000],
  ["Btc", 600000],
  ["Pythnet", 400],
] as const satisfies RoArray<readonly [ChainName, number]>;

export const blockTime = constMap(blockTimeMilliseconds);

// Some chains are required to post proof of their blocks to other chains
// and the transaction containing that proof must be finalized
// before a transaction contained in one of those blocks is considered final
// const rollupContracts = [
//   // mainnet/polygon/ethereum 0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287
//   // mainnet/optimism/ethereum 0xdfe97868233d1aa22e815a266982f2cf17685a27
//   // mainnet/arbitrum/ethereum 0x1c479675ad559dc151f6ec7ed3fbf8cee79582b6
//   //
//   // testnet/polygon/ethereum 0x2890ba17efe978480615e330ecb65333b880928e
//   // testnet/arbitrum/ethereum 0x45af9ed1d03703e480ce7d328fb684bb67da5049 // TODO, is there another one??
//   // testnet/optimism/ethereum 0xe6dfba0953616bacab0c9a8ecb3a9bba77fc15c0
//   //
// ];
//
