import { Connection, PublicKey } from '@solana/web3.js';
import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  ChainContext,
  TokenId,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { SolanaPlatform } from './platform';
import { UniversalOrSolana } from './types';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { SolanaAddress } from './address';

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

  async getTokenAccount(
    token: TokenId,
    address: UniversalAddress,
  ): Promise<UniversalAddress> {
    const wrapped = await this.getWrappedAsset(token);
    if (!wrapped)
      throw new Error(`No wrapped token on ${this.chain} for: ${token}`);

    const mint = new PublicKey(wrapped.address.unwrap());
    const owner = new PublicKey(address.unwrap());

    const ata = await getAssociatedTokenAddress(mint, owner);
    return new SolanaAddress(ata).toUniversalAddress();
  }
}
