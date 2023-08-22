import {
  TokenBridge,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import {
  Platform,
  RpcConnection,
  ChainContext,
  SignedTxn,
  TxHash,
  TokenTransferTransaction,
  TokenId,
} from '../../src/';
import { MockPlatform, MockRpc } from './mockPlatform';
import { MockTokenBridge } from './mockTokenBridge';

export class MockChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: MockPlatform;

  // Cached objects
  private rpc?: RpcConnection;
  private tokenBridge?: MockTokenBridge;

  constructor(platform: Platform, chain: ChainName) {
    this.chain = chain;
    this.network = platform.network!;
    this.platform = platform;
  }

  getRpc(): MockRpc {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc;
  }

  async getTokenBridge(): Promise<TokenBridge<'Evm'>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    const rpc = this.getRpc();
    const txhashes: TxHash[] = [];

    // TODO: concurrent
    for (const stxn of stxns) {
      console.log(`Sending: ${stxn}`);

      const txRes = await rpc!.broadcastTransaction(stxn);
      const txReceipt = await txRes.wait();
      console.log(txReceipt);
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt.hash);
    }
    return txhashes;
  }

  async getForeignAsset(tokenId: TokenId): Promise<UniversalAddress | null> {
    return this.platform.getForeignAsset(this.chain, this.getRpc(), tokenId);
  }
  async getTokenDecimals(tokenAddr: UniversalAddress): Promise<bigint> {
    return this.platform.getTokenDecimals(this.getRpc(), tokenAddr);
  }
  async getNativeBalance(walletAddr: string): Promise<bigint> {
    return this.platform.getNativeBalance(this.getRpc(), walletAddr);
  }
  async getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    return this.platform.getTokenBalance(
      this.chain,
      this.getRpc(),
      walletAddr,
      tokenId,
    );
  }

  async parseTransaction(txid: string): Promise<TokenTransferTransaction[]> {
    return [];
  }
}
