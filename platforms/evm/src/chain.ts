import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { UniversalAddress } from '@wormhole-foundation/sdk-definitions';
import { ethers } from 'ethers';
import { EvmPlatform } from './platform';
import { ChainContext, TokenId } from '@wormhole-foundation/connect-sdk';

export class EvmChain implements ChainContext {
  readonly chain: ChainName;
  readonly network: Network;
  readonly platform: EvmPlatform;

  // Cached RPC connection
  private provider?: ethers.Provider;

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
