import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  ChainContext,
  ChainConfig,
  Platform,
} from '@wormhole-foundation/sdk-definitions';
import { ethers } from 'ethers';

export class EvmChain extends ChainContext<'Evm'> {
  readonly chain: ChainName;
  readonly platform: Platform<'Evm'>;
  readonly conf: ChainConfig;

  // Cached objects
  private provider?: ethers.Provider;

  constructor(platform: Platform<'Evm'>, chain: ChainName) {
    super(platform, chain);

    this.chain = chain;
    this.conf = platform.conf[chain]!;
    this.platform = platform;
  }

  getRpc(): ethers.Provider {
    // @ts-ignore
    this.provider = this.provider
      ? this.provider
      : this.platform.getRpc(this.chain);

    return this.provider!;
  }
}
