import { Connection } from '@solana/web3.js';
import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import {
  SignedTxn,
  TokenTransferTransaction,
  TxHash,
  UniversalAddress,
  ChainContext,
  TokenId,
} from '@wormhole-foundation/sdk-definitions';
import { SolanaPlatform } from './platform';
import { SolanaTokenBridge } from './tokenBridge';

export class SolanaChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: SolanaPlatform;

  // Cached objects
  private tokenBridge?: SolanaTokenBridge;

  constructor(platform: SolanaPlatform, chain: ChainName) {
    this.chain = 'Solana';
    this.network = platform.network;
    this.platform = platform;
  }

  getConnection(): Connection {
    return this.platform.connection!;
  }

  async getTokenBridge(): Promise<SolanaTokenBridge> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.chain);
    return this.tokenBridge;
  }

  async parseTransaction(txid: string): Promise<TokenTransferTransaction[]> {
    return await this.platform.parseTransaction(this.chain, txid);
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    const connection = this.getConnection();
    const txhashes: TxHash[] = [];

    // TODO: concurrent
    for (const stxn of stxns) {
      console.log(`Sending: ${stxn}`);

      // TODO: Is this right?
      const txReceipt = await connection.sendRawTransaction(stxn);
      console.log(txReceipt);
      // TODO: throw error?
      if (txReceipt === null) continue;

      txhashes.push(txReceipt);
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
