import {
  Platform,
  RpcConnection,
  ChainContext,
  SignedTxn,
  TxHash,
  TokenTransferTransaction,
  TokenId,
} from '../../src/types';
import {
  ChainAddressPair,
  NativeAddress,
  TokenBridge,
  UniversalAddress,
  UniversalOrNative,
  UnsignedTransaction,
  VAA,
} from '@wormhole-foundation/sdk-definitions';
import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { MockPlatform, MockProvider } from './mockPlatform';
import { MockTokenBridge } from './mockTokenBridge';

export class MockChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: Platform;

  // Cached objects
  private provider?: MockProvider;
  private tokenBridge?: MockTokenBridge;

  constructor(platform: Platform, chain: ChainName) {
    this.chain = chain;
    this.network = platform.network!;
    this.platform = platform;
  }

  getRPC(): MockProvider | undefined {
    this.provider = this.provider
      ? this.provider
      : this.platform.getProvider(this.chain);

    return this.provider;
  }

  async getTokenBridge(): Promise<TokenBridge<'Evm'>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.chain, this.getRPC());
    return this.tokenBridge;
  }

  async getTransaction(txid: string): Promise<TokenTransferTransaction[]> {
    return await this.platform.parseTransaction(
      this.chain,
      txid,
      this.getRPC(),
    );
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    const rpc = this.getRPC();
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
    return this.platform.getForeignAsset(this.chain, tokenId);
  }
  async getTokenDecimals(tokenAddr: UniversalAddress): Promise<bigint> {
    return this.platform.getTokenDecimals(this.chain, tokenAddr);
  }
  async getNativeBalance(walletAddr: string): Promise<bigint> {
    return this.platform.getNativeBalance(this.chain, walletAddr);
  }
  async getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    return this.platform.getTokenBalance(this.chain, walletAddr, tokenId);
  }
}
