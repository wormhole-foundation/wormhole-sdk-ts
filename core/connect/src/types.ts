import {
  PlatformName,
  Network,
  ChainName,
} from '@wormhole-foundation/sdk-base';
import {
  UnsignedTransaction,
  ChainAddressPair,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';

import { ChainConfig } from './constants';

// TODO: move to definitions?
export type TxHash = string;
// Possibly duplicate definition?
export type SequenceId = bigint;

// TODO: move to definitions? Genericize
type Txn = UnsignedTransaction;
type SignedTxn = any;
export interface Signer {
  chain(): ChainName;
  address(): string;
  sign(tx: Txn): Promise<SignedTxn>;
}

// TODO: move to definition layer
export interface Platform {
  readonly type: PlatformName;
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
}

export type PlatformCtr = new (
  network: Network,
  conf: ChainsConfig,
) => Platform;

export type RpcConnection = any;

export interface ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  // TODO: config? move here

  getRPC(): RpcConnection;

  // add methods
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
