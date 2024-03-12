import type { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/sdk-connect";
import type { Transaction } from "algosdk";

/**
 * Runtime value for the Algorand Platform
 */
export const _platform: "Algorand" = "Algorand";
/**
 * Compile time Type for the Algorand Platform
 */
export type AlgorandPlatformType = typeof _platform;

export type AlgorandChains = PlatformToChains<AlgorandPlatformType>;
export type UniversalOrAlgorand = UniversalOrNative<AlgorandChains>;
export type AnyAlgorandAddress = UniversalOrAlgorand | string | Uint8Array | bigint;

export type LsigSigner = {
  address: string;
  signTxn(txn: Transaction): Promise<Uint8Array>;
};

export type TransactionSignerPair = {
  tx: Transaction;
  signer?: LsigSigner;
};

export type TransactionSet = {
  accounts: string[];
  txs: TransactionSignerPair[];
};

export function safeBigIntToNumber(b: bigint): number {
  if (b < BigInt(Number.MIN_SAFE_INTEGER) || b > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Integer is unsafe");
  }
  return Number(b);
}
