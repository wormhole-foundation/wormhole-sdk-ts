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
  // TODO: same hack as evm
  static _platform: P = 'Evm';
  readonly platform = MockPlatform._platform;
  conf: ChainsConfig;

  constructor(conf: ChainsConfig) {
    this.conf = conf;
    //this.contracts = new MockContracts(conf);
  }

  getAutomaticCircleBridge(
    rpc: RpcConnection,
  ): Promise<AutomaticCircleBridge<P>> {
    throw new Error('Method not implemented.');
  }

  getForeignAsset(
    chain: ChainName,
    rpc: RpcConnection,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null> {
    throw new Error('Method not implemented.');
  }
  getTokenDecimals(
    rpc: RpcConnection,
    tokenAddr: UniversalAddress,
  ): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getNativeBalance(rpc: RpcConnection, walletAddr: string): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getTokenBalance(
    chain: ChainName,
    rpc: RpcConnection,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    throw new Error('Method not implemented.');
  }
  getChain(chain: ChainName): ChainContext<'Evm'> {
    return new MockChain(this, chain);
  }
  getRpc(chain: ChainName): RpcConnection {
    return new MockRpc(chain);
  }
  async parseTransaction(
    chain: ChainName,
    rpc: RpcConnection,
    txid: TxHash,
  ): Promise<WormholeMessageId[]> {
    throw new Error('Method not implemented');
  }
  async sendWait(rpc: RpcConnection, stxns: any[]): Promise<TxHash[]> {
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

  async getTokenBridge(rpc: RpcConnection): Promise<TokenBridge<P>> {
    return new MockTokenBridge();
  }
  async getAutomaticTokenBridge(
    rpc: RpcConnection,
  ): Promise<AutomaticTokenBridge<P>> {
    throw new Error('Method not implemented.');
  }
  async getCircleBridge(rpc: RpcConnection): Promise<CircleBridge<P>> {
    throw new Error('Method not implemented.');
  }
  async getCircleRelayer(
    rpc: RpcConnection,
  ): Promise<AutomaticCircleBridge<'Evm'>> {
    throw new Error('Method Not implemented.');
  }
  parseAddress(address: string): UniversalAddress {
    throw new Error('Method not implemented.');
  }
}
