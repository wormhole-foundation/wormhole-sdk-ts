import { PlatformToChains, UniversalOrNative } from "@wormhole-foundation/connect-sdk";
import { Transaction } from "algosdk";

export const _platform: "Algorand" = "Algorand";
export type AlgorandPlatformType = typeof _platform;

export type AlgorandChains = PlatformToChains<AlgorandPlatformType>;
export type UniversalOrAlgorand = UniversalOrNative<AlgorandChains>;
export type AnyAlgorandAddress = UniversalOrAlgorand | string | Uint8Array | bigint;

export type Signer = {
  addr: string;
  signTxn(txn: Transaction): Promise<Uint8Array>;
};

export type TransactionSignerPair = {
  tx: Transaction;
  signer?: Signer;
};
