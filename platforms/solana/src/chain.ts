import { Connection } from '@solana/web3.js';
import { ChainName } from '@wormhole-foundation/sdk-base';
import { ChainContext } from '@wormhole-foundation/sdk-definitions';
import { SolanaPlatform } from './platform';

export class SolanaChain extends ChainContext<'Solana'> {
  // Cached objects
  private connection?: Connection;

  constructor(platform: SolanaPlatform, chain: ChainName) {
    super(platform, chain);
  }

  getRpc(): Connection {
    // @ts-ignore
    this.connection = this.connection
      ? this.connection
      : this.platform.getRpc(this.chain);
    return this.connection!;
  }
}
