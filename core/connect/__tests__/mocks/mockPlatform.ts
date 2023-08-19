import {
  ChainContext,
  Platform,
  TokenId,
  TokenTransferTransaction,
} from '../../src/types';
import {
  Network,
  PlatformName,
  ChainName,
} from '@wormhole-foundation/sdk-base';
import {
  TokenBridge,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { RpcConnection, TxHash } from '../../dist/esm';
import { MockTokenBridge } from './mockTokenBridge';
import { MockChain } from './mockChain';

export class MockProvider {
  constructor(chain: ChainName) {}
  broadcastTransaction(stxns: any): any {
    throw new Error('Not implemented');
  }
}

export class MockPlatform implements Platform {
  // TODO: same hack as evm
  static _platform: PlatformName = 'Evm';
  readonly platform = MockPlatform._platform;

  readonly network?: Network = 'Devnet';
  getForeignAsset(
    chain: ChainName,
    tokenId: TokenId,
  ): Promise<UniversalAddress | null> {
    throw new Error('Method not implemented.');
  }
  getTokenDecimals(
    chain: ChainName,
    tokenAddr: UniversalAddress,
  ): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getNativeBalance(walletAddr: string, chain: ChainName): Promise<bigint> {
    throw new Error('Method not implemented.');
  }
  getTokenBalance(
    chain: ChainName,
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    throw new Error('Method not implemented.');
  }
  getChain(chain: ChainName): ChainContext {
    return new MockChain(this, chain);
  }
  getProvider(chain: ChainName): RpcConnection {
    return new MockProvider(chain);
  }
  async parseTransaction(
    chain: ChainName,
    txid: TxHash,
    rpc: RpcConnection,
  ): Promise<TokenTransferTransaction[]> {
    throw new Error('not implemented');
    return [];
  }
  async getTokenBridge(
    chain: ChainName,
    rpc: RpcConnection,
  ): Promise<TokenBridge<PlatformName>> {
    return new MockTokenBridge();
  }
  parseAddress(address: string): UniversalAddress {
    throw new Error('Method not implemented.');
  }
}
