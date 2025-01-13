import type { MapLevel } from "./../utils/index.js";
import { constMap } from "./../utils/index.js";
import type { Chain } from "./chains.js";

// https://www.notion.so/Finality-in-Wormhole-78ffa423abd44b7cbe38483a16040d83

// prettier-ignore
// Recognized Consistency Levels for determining when a guardian
// may sign a VAA for a given wormhole message
export enum ConsistencyLevels {
  // SolanaConfirmed = 0,
  Finalized = 1,
  Immediate = 200,
  Safe      = 201,
}

// Number of blocks before a transaction is considered "safe"
// In this case its the number of rounds for each epoch, once an epoch
// is completed, the transaction is considered safe
const safeThresholds = [
  ["Ethereum", 32], // number of rounds in an epoch
] as const satisfies MapLevel<Chain, number>;
export const safeThreshold = constMap(safeThresholds);

// prettier-ignore
// Number of blocks before a transaction is considered "final"
const finalityThresholds = [
  ["Solana",   32],
  ["Ethereum", 72], // between 64 and 95 blocks; use 72 as a middle ground
  ["Bsc",      15],
  // Check-pointed to L1 after ~512 blocks
  ["Optimism",  512],
  ["Base",      512],
  ["Arbitrum", 4096], // TODO: validate, this is inferred from vaa metrics timing
  ["Blast",     512],
  ["Xlayer",    300],
  ["Scroll",    300],
  ["Mantle",    512],
  ["Worldchain",512],
  // Check-pointed after 32 blocks
  ["Polygon",  32],
  // Single block finality
  ["Fantom",    1],
  ["Celo",      1],
  ["Moonbeam",  1],
  ["Karura",    1],
  ["Acala",     1],
  ["Oasis",     1], 
  // Instant finality
  ["Avalanche", 0],
  ["Sui",       0],
  ["Algorand",  0],
  ["Aptos",     0],
  ["Klaytn",    0],
  ["Sei",       0],
  ["Near",      0],
  ["Osmosis",   0],
  ["Terra",     0],
  ["Terra2",    0],
  ["Xpla",      0],
  ["Injective", 0],
  ["Berachain", 1],
  ["Seievm",    1],
  ["Snaxchain", 512],
  ["Unichain",  512],
  ["Ink",       512],
  ["HyperEVM",  1],
  ["Monad",     1],
  ["Cosmoshub", 0],
  ["Evmos",     0],
  ["Kujira",    0],
  ["Neutron",   0],
  ["Celestia",  0],
  ["Stargaze",  0],
  ["Dymension", 0],
  ["Provenance",0],
  ["Noble",     0],
  // Testnets
  ["Sepolia", 72],
  ["ArbitrumSepolia", 4096],
  ["BaseSepolia", 512],
  ["OptimismSepolia", 512],
  ["PolygonSepolia", 32],
  ["MonadDevnet", 1],
] as const satisfies MapLevel<Chain, number>;

/**
 * The number of blocks before a transaction may be considered "final" and
 * will not be rolled back
 */
export const finalityThreshold = constMap(finalityThresholds);

// prettier-ignore
// number of milliseconds between blocks
const blockTimeMilliseconds = [
  ["Acala",            12_000],
  ["Algorand",          3_300],
  ["Aptos",             4_000],
  ["Arbitrum",            260],
  ["ArbitrumSepolia",     260],
  ["Aurora",            3_000],
  ["Avalanche",         2_000],
  ["Base",              2_000],
  ["BaseSepolia",       2_000],
  ["Blast",             2_000],
  ["Bsc",               3_000],
  ["Celo",              5_000],
  ["Cosmoshub",         5_000],
  ["Ethereum",         15_000],
  ["Evmos",             2_000],
  ["Fantom",            2_500],
  ["Gnosis",            5_000],
  ["Holesky",          15_000],
  ["Injective",         2_500],
  ["Karura",           12_000],
  ["Klaytn",            1_000],
  ["Kujira",            3_000],
  ["Mantle",            2_000],
  ["Moonbeam",         12_000],
  ["Monad",             1_000],
  ["MonadDevnet",       1_000],
  ["Near",              1_500],
  ["Neon",             30_000],
  ["Oasis",             6_000],
  ["Optimism",          2_000],
  ["OptimismSepolia",   2_000],
  ["Osmosis",           6_000],
  ["Polygon",           2_000],
  ["PolygonSepolia",    2_000],
  ["Rootstock",        30_000],
  ["Scroll",            3_000],
  ["Sei",                 400],
  ["Sepolia",          15_000],
  ["Solana",              400],
  ["Sui",               3_000],
  ["Terra",             6_000],
  ["Terra2",            6_000],
  ["Xpla",              5_000],
  ["Xlayer",            3_000],
  ["Worldchain",        2_000],
  ["Wormchain",         5_000],
  ["Btc",             600_000],
  ["Pythnet",             400],
  ["Dymension",         5_000],
  ["Celestia",          5_000],
  ["Neutron",           5_000],
  ["Stargaze",          5_000],
  ["Seda",              7_500],
] as const satisfies MapLevel<Chain, number>;

/** The amount of time between block production, in milliseconds  */
export const blockTime = constMap(blockTimeMilliseconds);

/**
 * Estimate the block number that a VAA might be available
 * for a given chain, initial block where the tx was submitted
 * and consistency level
 */
export function consistencyLevelToBlock(
  chain: Chain,
  consistencyLevel: number,
  fromBlock: bigint = 0n,
): bigint {
  // We're done
  if (consistencyLevel === ConsistencyLevels.Immediate) return fromBlock;

  // Bsc is the only chain that treats consistency level as # of blocks
  if (chain === "Bsc") return fromBlock + BigInt(consistencyLevel);

  // On Solana 0 is "confirmed", for now just return fromBlock since we
  // have no way of estimating when 66% of the network will have confirmed
  if (chain === "Solana" && consistencyLevel === 0) return fromBlock;

  // Get the number of blocks until finalized
  const chainFinality = finalityThreshold.get(chain);
  if (chainFinality === undefined) throw new Error("Cannot find chain finality for " + chain);

  // If chain finality threshold is 0, it's always instant
  if (chainFinality === 0) return fromBlock;

  // We've handled all the other cases so anything != safe is `finalized`
  if (consistencyLevel !== ConsistencyLevels.Safe) return fromBlock + BigInt(chainFinality);

  // We're only in Safe mode now
  const safeRounds = safeThreshold.get(chain);
  if (safeRounds === undefined) throw new Error("Cannot find safe threshold for " + chain);

  switch (chain) {
    case "Ethereum":
      // On Ethereum "safe" is 1 epoch
      // return the number of blocks until the end
      // of the current epoch
      // 0 is end of epoch, 1 is start
      const epochPosition = fromBlock % BigInt(safeRounds);
      const blocksUntilEndOfEpoch = epochPosition === 0n ? 0n : BigInt(safeRounds) - epochPosition;
      return fromBlock + blocksUntilEndOfEpoch;

    default:
      throw new Error("Only Ethereum safe is supported for now");
  }
}

/**
 * Estimates the time required for a transaction to be considered "final"
 * @param chain The chain to estimate finality time for
 * @returns The estimated time in milliseconds
 */
export function estimateFinalityTime(chain: Chain): number {
  const finality = finalityThreshold.get(chain);
  if (finality === undefined) throw new Error("Cannot find finality for " + chain);

  const time = blockTime.get(chain);
  if (time === undefined) throw new Error("Cannot find block time for " + chain);

  return finality * time;
}
