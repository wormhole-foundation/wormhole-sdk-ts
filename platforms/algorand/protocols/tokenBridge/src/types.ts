import { ChainId } from "@wormhole-foundation/connect-sdk";
import { LogicSigAccount } from "algosdk";
import { TransactionSignerPair } from "@wormhole-foundation/connect-sdk-algorand";

export type OptInResult = {
  addr: string;
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

export type ParsedVAA = {
  version: number;
  index: number;
  siglen: number;
  signatures: Uint8Array;
  sigs: Uint8Array[];
  digest: Uint8Array;
  timestamp: number;
  nonce: number;
  chainRaw: string;
  chain: number;
  emitter: string;
  sequence: bigint;
  consistency: number;
  Meta:
    | "Unknown"
    | "TokenBridge"
    | "TokenBridge RegisterChain"
    | "TokenBridge UpgradeContract"
    | "CoreGovernance"
    | "TokenBridge Attest"
    | "TokenBridge Transfer"
    | "TokenBridge Transfer With Payload";
  module?: Uint8Array;
  action?: number;
  targetChain?: number;
  EmitterChainID?: number;
  targetEmitter?: Uint8Array;
  newContract?: Uint8Array;
  NewGuardianSetIndex?: number;
  Type?: number;
  Contract?: string;
  FromChain?: number;
  Decimals?: number;
  Symbol?: Uint8Array;
  Name?: Uint8Array;
  TokenId?: Uint8Array;
  Amount?: Uint8Array;
  ToAddress?: Uint8Array;
  ToChain?: number;
  Fee?: Uint8Array;
  FromAddress?: Uint8Array;
  Payload?: Uint8Array;
  Body?: Uint8Array;
  uri?: string;
};
