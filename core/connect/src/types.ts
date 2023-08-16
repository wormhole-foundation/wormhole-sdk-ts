import {
  PlatformName,
  Network,
  ChainName,
} from '@wormhole-foundation/sdk-base';
import {
  UnsignedTransaction,
  ChainAddressPair,
  UniversalAddress,
  TokenBridge,
  Address,
} from '@wormhole-foundation/sdk-definitions';

import { ChainConfig } from './constants';

// TODO: move to definitions?
export type TxHash = string;
// Possibly duplicate definition?
export type SequenceId = bigint;

// TODO: move to definitions? Genericize
export type Txn = UnsignedTransaction;
export type SignedTxn = any;
export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: Txn[]): Promise<SignedTxn[]>;
}

// TODO: move to definition layer
export interface Platform {
  readonly platform: PlatformName;
  // TODO: Asset vs token?
  getForeignAsset(
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<UniversalAddress | null>;
  getTokenDecimals(
    tokenAddr: UniversalAddress,
    chain: ChainName,
  ): Promise<bigint>;
  getNativeBalance(walletAddr: string, chain: ChainName): Promise<bigint>;
  getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
    chain: ChainName,
  ): Promise<bigint | null>;
  getChain(chain: ChainName): ChainContext;
  parseAddress(address: string): UniversalAddress;
}

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};

export type RpcConnection = any;

// TODO: idk if this is actually doing what i want
type OmitChain<Fn> = Fn extends (...args: infer P) => infer R
  ? (...args: Exclude<P, ChainName>) => R
  : never;

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getRPC(): RpcConnection;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;
  getTokenBridge(): Promise<TokenBridge<'Evm'>>;
  getTransaction(txid: string): Promise<any>;

  getForeignAsset: OmitChain<Platform['getForeignAsset']>;
  getTokenDecimals: OmitChain<Platform['getTokenDecimals']>;
  getNativeBalance: OmitChain<Platform['getNativeBalance']>;
  getTokenBalance: OmitChain<Platform['getTokenBalance']>;
}

export type ChainCtr = new () => ChainContext;

export type ChainsConfig = {
  [K in ChainName]?: ChainConfig;
};
export type WormholeConfig = {
  network: Network;
  api: string;
  chains: ChainsConfig;
};

export type TokenId = ChainAddressPair;
export type MessageIdentifier = ChainAddressPair & { sequence: SequenceId };
export type WormholeWrappedInfo = ChainAddressPair & { isWrapped: boolean };

export type TokenTransferTransaction = {
  sendTx: TxHash;

  fromChain: ChainName;
  sender: string;

  toChain: ChainName;
  recipient: string;

  tokenId: TokenId;
  amount: bigint;

  emitterAddress: string;
  sequence: bigint;

  payloadID: bigint;

  block: bigint;
  gasFee: bigint;
};
