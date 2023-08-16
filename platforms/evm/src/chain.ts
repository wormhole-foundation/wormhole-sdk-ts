import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { ethers } from 'ethers';
import { EvmPlatform } from './platform';
import {
  ChainContext,
  TokenId,
  TxHash,
  SignedTxn,
} from '@wormhole-foundation/connect-sdk';
import { EvmTokenBridge } from './tokenBridge';

export class EvmChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: EvmPlatform;

  // Cached objects
  private provider?: ethers.Provider;
  private tokenBridge?: EvmTokenBridge;

  constructor(platform: EvmPlatform, chain: ChainName) {
    this.chain = chain;
    this.network = platform.network;
    this.platform = platform;
  }

  getRPC(): ethers.Provider {
    this.provider = this.provider
      ? this.provider
      : this.platform.getProvider(this.chain);

    return this.provider;
  }

  async getTokenBridge(): Promise<EvmTokenBridge> {
    this.tokenBridge = this.tokenBridge
      ? this.tokenBridge
      : await this.platform.getTokenBridge(this.getRPC());
    return this.tokenBridge;
  }

  async sendWait(stxns: SignedTxn[]): Promise<TxHash[]> {
    // TODO: horrible?
    const txhashes: TxHash[] = [];
    const rpc = this.getRPC();
    for (const stxn of stxns) {
      const receipt = await rpc.broadcastTransaction(stxn);
      txhashes.push(receipt.hash);
    }
    return txhashes;
  }

  async getForeignAsset(tokenId: TokenId): Promise<UniversalAddress | null> {
    return this.platform.getForeignAsset(tokenId, this.chain);
  }
  async getTokenDecimals(tokenAddr: UniversalAddress): Promise<bigint> {
    return this.platform.getTokenDecimals(tokenAddr, this.chain);
  }
  async getNativeBalance(walletAddr: string): Promise<bigint> {
    return this.platform.getNativeBalance(walletAddr, this.chain);
  }
  async getTokenBalance(
    walletAddr: string,
    tokenId: TokenId,
  ): Promise<bigint | null> {
    return this.platform.getTokenBalance(walletAddr, tokenId, this.chain);
  }
}
