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
// TODO: move to definition layer
export abstract class Platform {
  public static platform: PlatformName;
  abstract network: Network;
  abstract conf: ChainsConfig;
  // TODO: Asset vs token?
  abstract getForeignAsset(
    rpc: RpcConnection,
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null>;
  abstract getTokenDecimals(
    rpc: RpcConnection,
    tokenAddr: UniversalAddress,
  ): Promise<bigint>;
  abstract getNativeBalance(rpc: RpcConnection, walletAddr: string, chain: ChainName): Promise<bigint>;
  abstract getTokenBalance(
    rpc: RpcConnection,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null>;
  abstract getRpc(chain: ChainName): RpcConnection;
  abstract getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<PlatformName>>;
  abstract getChain(chain: ChainName): ChainContext;
  abstract parseAddress(address: string): UniversalAddress;
  abstract parseTransaction(
    rpc: RpcConnection,
    chain: ChainName,
    txid: TxHash,
  ): Promise<TokenTransferTransaction[]>;
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
  getRPC(): RpcConnection;
  sendWait(stxns: SignedTxn[]): Promise<TxHash[]>;
  getTokenBridge(): Promise<TokenBridge<PlatformName>>;

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

export type TokenId = ChainAddressPair;
export type MessageIdentifier = ChainAddressPair & { sequence: SequenceId };
export type TransactionIdentifier = { chain: ChainName; txid: TxHash };

export type TokenTransferDetails = {
  token: TokenId | 'native';
  amount: bigint;
  payload?: Uint8Array;
  from: ChainAddressPair;
  to: ChainAddressPair;
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
