import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  ChainContext,
  Platform,
  TxHash,
  RpcConnection,
  TokenId,
  AutomaticTokenBridge,
  TokenBridge,
  UniversalAddress,
  WormholeMessageId,
  CircleBridge,
  AutomaticCircleBridge,
  ChainsConfig,
} from '@wormhole-foundation/sdk-definitions';
import { MockTokenBridge } from './mockTokenBridge';
import { MockChain } from './mockChain';
import { MockContracts } from './mockContracts';

export class MockRpc {
  constructor(chain: ChainName) {}
  getBalance(address: string): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  broadcastTransaction(stxns: any): any {
    throw new Error('Not implemented');
  }
}

type P = 'Evm';

export class MockPlatform implements Platform<P> {
  static _platform: P = 'Evm';
  readonly platform = MockPlatform._platform;
  conf: ChainsConfig;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
  }

  getAutomaticCircleBridge(
    rpc: RpcConnection<P>,
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error('Method not implemented.');
  }

  getWrappedAsset(
    chain: ChainName,
    rpc: RpcConnection<P>,
    token: TokenId,
  ): Promise<TokenId | null> {
    throw new Error('Method not implemented.');
  }
  getTokenDecimals(rpc: RpcConnection<P>, token: TokenId): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getNativeBalance(rpc: RpcConnection<P>, walletAddr: string): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection<P>,
    walletAddr: string,
    token: TokenId,
  ): Promise<bigint | null> {
    throw new Error('Method not implemented.');
  }
  getChain(chain: ChainName): ChainContext<'Evm'> {
    return new MockChain(this, chain);
  }
  getRpc(chain: ChainName): RpcConnection<P> {
    return new MockRpc(chain);
  }
  async parseTransaction(
    chain: ChainName,
    rpc: RpcConnection<P>,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    throw new Error('Method not implemented');
  }
  async sendWait(rpc: RpcConnection<P>, stxns: any[]): Promise<TxHash[]> {
    const txhashes: TxHash[] = [];

    // TODO: concurrent
    for (const stxn of stxns) {
      const txRes = await rpc.broadcastTransaction(stxn);
      const txReceipt = await txRes.wait();
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt.hash);
    }
    return txhashes;
  }

  async getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>> {
    return new MockTokenBridge();
  }
  async getAutomaticTokenBridge(
    rpc: RpcConnection<P>,
  ): Promise<AutomaticTokenBridge<P>> {
    throw new Error('Method not implemented.');
  }
  async getCircleBridge(rpc: RpcConnection<P>): Promise<CircleBridge<P>> {
    throw new Error('Method not implemented.');
  }
  async getCircleRelayer(
    rpc: RpcConnection<P>,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    throw new Error('Method Not implemented.');
  }
  parseAddress(address: string): UniversalAddress {
    throw new Error('Method not implemented.');
  }
}
