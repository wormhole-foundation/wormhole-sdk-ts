import {
  PlatformName,
  Network,
  ChainName,
} from '@wormhole-foundation/sdk-base';
import {
  UnsignedTransaction,
  ChainAddress,
  UniversalAddress,
  TokenBridge,
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
  readonly network?: Network;
  // TODO: Asset vs token?
  getForeignAsset(
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null>;
  getTokenDecimals(
    chain: ChainName,
    tokenAddr: UniversalAddress,
  ): Promise<bigint>;
  getNativeBalance(chain: ChainName, walletAddr: string): Promise<bigint>;
  getTokenBalance(
    chain: ChainName,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null>;
  //
  getChain(chain: ChainName): ChainContext;
  getProvider(chain: ChainName): RpcConnection;
  // Pass in RPC, the ChainContext should hold any cached rpc
  // and be passed in
  getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<PlatformName>>;
  parseTransaction(
    chain: ChainName,
    txid: TxHash,
    rpc: RpcConnection,
  ): Promise<TokenTransferTransaction[]>;
  parseAddress(address: string): UniversalAddress;
}

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};

export type RpcConnection = any;

type OmitChain<Fn> = Fn extends (chain: ChainName, ...args: infer P) => infer R
  ? (...args: P) => R
  : never;

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getRPC(): RpcConnection;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;
  getTokenBridge(): Promise<TokenBridge<PlatformName>>;

  // TODO: can we add these automatically?
  getForeignAsset: OmitChain<Platform['getForeignAsset']>;
  getTokenDecimals: OmitChain<Platform['getTokenDecimals']>;
  getNativeBalance: OmitChain<Platform['getNativeBalance']>;
  getTokenBalance: OmitChain<Platform['getTokenBalance']>;

  // query rpc
  getFinalizedHeight(): Promise<bigint>;
  getTransaction(txid: string): Promise<TokenTransferTransaction[]>;
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

export type TokenId = ChainAddress;

export type MessageIdentifier = ChainAddress & { sequence: SequenceId };
export function isMessageIdentifier(
  thing: MessageIdentifier | any,
): thing is MessageIdentifier {
  return (<MessageIdentifier>thing).sequence !== undefined;
}

export type TransactionIdentifier = { chain: ChainName; txid: TxHash };
export function isTransactionIdentifier(
  thing: TransactionIdentifier | any,
): thing is TransactionIdentifier {
  return (
    (<TransactionIdentifier>thing).chain !== undefined &&
    (<TransactionIdentifier>thing).txid !== undefined
  );
}

export type TokenTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
  fromChain: ChainContext;
  toChain: ChainContext;
  from: Signer | UniversalAddress;
  to: Signer | UniversalAddress;
};

export function isTokenTransferDetails(
  thing: TokenTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<TokenTransferDetails>thing).token !== undefined &&
    (<TokenTransferDetails>thing).amount !== undefined &&
    (<TokenTransferDetails>thing).fromChain !== undefined &&
    (<TokenTransferDetails>thing).toChain !== undefined
  );
}

export type WormholeMessage = {
  tx: TransactionIdentifier;

  msg: MessageIdentifier;
};

// Details for a source chain Token Transfer transaction
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
