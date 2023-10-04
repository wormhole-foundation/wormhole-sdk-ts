import {
  PlatformName,
  ChainName,
  Network,
} from '@wormhole-foundation/sdk-base';
import { ChainContext } from './chain';
import { RpcConnection } from './rpc';
import { ChainsConfig, TokenId, TxHash } from './types';
import { WormholeMessageId } from './attestation';
import { SignedTx } from './types';

export interface PlatformUtils<P extends PlatformName> {
  nativeTokenId(chain: ChainName): TokenId;

  isSupportedChain(chain: ChainName): boolean;

  isNativeTokenId(chain: ChainName, tokenId: TokenId): boolean;

  // Utils for platform specific queries
  getDecimals(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId | 'native',
  ): Promise<bigint>;
  getBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId | 'native',
  ): Promise<bigint | null>;
  getCurrentBlock(rpc: RpcConnection<P>): Promise<number>;

  // Platform interaction utils
  sendWait(
    chain: ChainName,
    rpc: RpcConnection<P>,
    stxns: SignedTx[],
  ): Promise<TxHash[]>;

  chainFromRpc(rpc: RpcConnection<P>): Promise<[Network, ChainName]>;
}

// Force passing RPC connection so we don't create a new one with every fn call
export interface Platform<P extends PlatformName> extends PlatformUtils<P> {
  readonly platform: P;
  readonly conf: ChainsConfig;
  readonly network: Network;

  // update the config for this platform
  setConfig(network: Network, _conf?: ChainsConfig): Platform<P>;

  // Create a new Chain context object
  getChain(chain: ChainName): ChainContext<P>;

  getRpc(chain: ChainName): RpcConnection<P>;

  parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]>;
}
