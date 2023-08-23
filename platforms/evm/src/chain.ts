import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import {
  AutomaticTokenBridge,
  WormholeCircleRelayer,
  CircleBridge,
  TokenBridge,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { ethers } from 'ethers';
import { EvmPlatform } from './platform';
import {
  ChainContext,
  TokenId,
  TxHash,
  SignedTxn,
  TokenTransferTransaction,
  ChainConfig,
} from '@wormhole-foundation/connect-sdk';

export class EvmChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: EvmPlatform;
  readonly conf: ChainConfig;

  // Cached objects
  private provider?: ethers.Provider;
  private tokenBridge?: TokenBridge<'Evm'>;
  private autoTokenBridge?: AutomaticTokenBridge<'Evm'>;
  private circleRelayer?: WormholeCircleRelayer<'Evm'>;
  private circleBridge?: CircleBridge<'Evm'>;

  constructor(platform: EvmPlatform, chain: ChainName) {
    this.chain = chain;
    this.network = platform.network;
    this.conf = platform.conf[chain]!;
    this.platform = platform;
  }

  getRpc(): ethers.Provider {
    this.provider = this.provider
      ? this.provider
      : this.platform.getRpc(this.chain);

    return this.provider;
  }

  async getTokenBridge(): Promise<TokenBridge<'Evm'>> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRpc());
    return this.tokenBridge;
  }

  async getAutomaticTokenBridge(): Promise<AutomaticTokenBridge<'Evm'>> {
    this.autoTokenBridge = this.autoTokenBridge
      ? this.autoTokenBridge
      : await this.platform.getAutomaticTokenBridge(this.getRpc());
    return this.autoTokenBridge;
  }

  async getCircleRelayer(): Promise<WormholeCircleRelayer<'Evm'>> {
    this.circleRelayer = this.circleRelayer
      ? this.circleRelayer
      : await this.platform.getCircleRelayer(this.getRpc());
    return this.circleRelayer;
  }
  async getCircleBridge(): Promise<CircleBridge<'Evm'>> {
    this.circleBridge = this.circleBridge
      ? this.circleBridge
      : await this.platform.getCircleBridge(this.getRpc());
    return this.circleBridge;
  }

  async parseTransaction(txid: string): Promise<TokenTransferTransaction[]> {
    return await this.platform.parseTransaction(
      this.chain,
      this.getRpc(),
      txid,
    );
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    const rpc = this.getRpc();
    const txhashes: TxHash[] = [];

    // TODO: concurrent
    for (const stxn of stxns) {
      console.log(`Sending: ${stxn}`);

      const txRes = await rpc.broadcastTransaction(stxn);
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
}
