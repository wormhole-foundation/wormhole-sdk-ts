import { ChainName, Network } from '@wormhole-foundation/sdk-base';
import { ethers } from 'ethers';
import { EvmPlatform } from './platform';
import { ChainsConfig } from '@wormhole-foundation/connect-sdk';

export class EvmChain extends EvmPlatform {
  chain: ChainName;
  network: Network;

  private provider?: ethers.Provider;

  constructor(network: Network, conf: ChainsConfig, chain: ChainName) {
    super(network, conf);
    this.chain = chain;
    this.network = network;
  }

  getRPC(): ethers.Provider {
    // Cache instance
    if (this.provider) return this.provider;
    this.provider = this.getProvider(this.chain);
    return this.provider;
  }
}
