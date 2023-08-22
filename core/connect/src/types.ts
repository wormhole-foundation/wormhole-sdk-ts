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
  AutomaticTokenBridge,
} from '@wormhole-foundation/sdk-definitions';

import { ChainConfig } from './constants';

export type TxHash = string;
export type SequenceId = bigint;

// TODO: move to definitions? Genericize
export type SignedTxn = any;
export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: UnsignedTransaction[]): Promise<SignedTxn[]>;
}

// TODO: definition layer? more flexible?
export interface RpcConnection {
  broadcastTransaction(stxns: string): Promise<any>;
  getBalance(address: string): Promise<bigint>;
}

// TODO: move to definition layer? -- Can't without more changes, TokenTransferTransaction declared here
// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform {
  readonly platform: PlatformName;
  readonly network?: Network;
  getForeignAsset(
    chain: ChainName,
    rpc: RpcConnection,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null>;
  getTokenDecimals(
    rpc: RpcConnection,
    tokenAddr: UniversalAddress,
  ): Promise<bigint>;
  getNativeBalance(rpc: RpcConnection, walletAddr: string): Promise<bigint>;
  getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null>;
  //
  getChain(chain: ChainName): ChainContext;
  getRpc(chain: ChainName): RpcConnection;
  // protocol clients
  getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<PlatformName>>;
  getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<PlatformName>>;

  parseTransaction(
    chain: ChainName,
    rpc: RpcConnection,
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]>;
  parseAddress(address: string): UniversalAddress;
}

export type PlatformCtr = {
  _platform: PlatformName;
  new (network: Network, conf: ChainsConfig): Platform;
};

// This requires the arguments in the function definition come in the same order
// [chain], [rpc], ...

type OmitChain<Fn> = Fn extends (chain: ChainName, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;
type OmitRpc<Fn> = Fn extends (rpc: RpcConnection, ...args: infer P) => infer R
  ? (...args: P) => R
  : Fn;

type OmitChainRpc<Fn> = OmitRpc<OmitChain<Fn>>;

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;
  getRpc(): RpcConnection;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;

  getTokenBridge(): Promise<TokenBridge<PlatformName>>;
  getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<PlatformName>>;

  // TODO: can we add these automatically?
  getForeignAsset: OmitChainRpc<Platform['getForeignAsset']>;
  getTokenDecimals: OmitChainRpc<Platform['getTokenDecimals']>;
  getNativeBalance: OmitChainRpc<Platform['getNativeBalance']>;
  getTokenBalance: OmitChainRpc<Platform['getTokenBalance']>;
  parseTransaction: OmitChainRpc<Platform['parseTransaction']>;
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
export type TransactionIdentifier = { chain: ChainName; txid: TxHash };

export type TokenTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
  from: ChainAddress;
  to: ChainAddress;
};

export type WormholeMessage = {
  tx: TransactionIdentifier;
  msg: MessageIdentifier;
  payloadId: bigint;
};

// Details for a source chain Token Transfer transaction
export type TokenTransferTransaction = {
  message: WormholeMessage;

  details: TokenTransferDetails;
  block: bigint;
  gasFee: bigint;
};

export function isMessageIdentifier(
  thing: MessageIdentifier | any,
): thing is MessageIdentifier {
  return (<MessageIdentifier>thing).sequence !== undefined;
}

export function isTransactionIdentifier(
  thing: TransactionIdentifier | any,
): thing is TransactionIdentifier {
  return (
    (<TransactionIdentifier>thing).chain !== undefined &&
    (<TransactionIdentifier>thing).txid !== undefined
  );
}

export function isTokenTransferDetails(
  thing: TokenTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<TokenTransferDetails>thing).token !== undefined &&
    (<TokenTransferDetails>thing).amount !== undefined &&
    (<TokenTransferDetails>thing).from !== undefined &&
    (<TokenTransferDetails>thing).to !== undefined
  );
}
