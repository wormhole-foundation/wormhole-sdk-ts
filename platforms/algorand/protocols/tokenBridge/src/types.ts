import { ChainId } from "@wormhole-foundation/connect-sdk";
import { LogicSigAccount } from "algosdk";
import { TransactionSignerPair } from "@wormhole-foundation/connect-sdk-algorand";

export type TransactionSet = {
  address: string;
  txs: TransactionSignerPair[];
};

export interface WormholeWrappedInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: Uint8Array;
}

export type LogicSigAccountInfo = {
  lsa: LogicSigAccount;
  doesExist: boolean;
};
