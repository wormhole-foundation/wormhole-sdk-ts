import { Connection, TokenBalance } from '@solana/web3.js';
import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import {
  SignedTxn,
  TxHash,
  UniversalAddress,
  ChainContext,
  TokenId,
  TokenBridge,
  AutomaticTokenBridge,
  CircleBridge,
  AutomaticCircleBridge,
  WormholeMessageId,
} from '@wormhole-foundation/sdk-definitions';
import { SolanaPlatform } from './platform';

export class SolanaChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: SolanaPlatform;

  // Cached objects
  private connection?: Connection;
  private tokenBridge?: TokenBridge<'Solana'>;
  private autoTokenBridge?: AutomaticTokenBridge<'Solana'>;
  private circleBridge?: CircleBridge<'Solana'>;
  private autoCircleBridge?: AutomaticCircleBridge<'Solana'>;

  constructor(platform: SolanaPlatform, chain: ChainName) {
    this.chain = chain;
    this.network = platform.network;
    this.platform = platform;
  }

  getRpc(): Connection {
    this.connection = this.connection
      ? this.connection
      : this.platform.getRpc(this.chain);
    return this.connection;
  }

  async getTokenBridge(): Promise<TokenBridge<'Solana'>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  }

  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<'Solana'>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getAutomaticTokenBridge(this.getRpc());
    return this.autoTokenBridge;
  }

  async getAutomaticCircleBridge(): Promise<AutomaticCircleBridge<'Solana'>> {
    this.autoCircleBridge = this.autoCircleBridge
      ? this.autoCircleBridge
      : await this.platform.getAutomaticCircleBridge(this.getRpc());
    return this.autoCircleBridge;
  }
  async getCircleBridge(): Promise<CircleBridge<'Solana'>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(this.getRpc());
    return this.circleBridge;
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    return await this.platform.parseTransaction(
      this.chain,
      this.getRpc(),
      txid,
    );
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    const connection = this.getRpc();
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
}
