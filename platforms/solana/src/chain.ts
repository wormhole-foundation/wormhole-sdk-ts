import { PublicKey } from '@solana/web3.js';
import { ChainName } from '@wormhole-foundation/sdk-base';
import {
  ChainContext,
  RpcConnection,
  TokenId,
  UniversalAddress,
} from '@wormhole-foundation/sdk-definitions';
import { SolanaPlatform } from './platform';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export class SolanaChain extends ChainContext<'Solana'> {
  // Cached objects
  private connection?: RpcConnection<'Solana'>;

  constructor(platform: SolanaPlatform, chain: ChainName) {
    super(platform, chain);
  }

  getRpc(): RpcConnection<'Solana'> {
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
    return this.parseAddress(ata.toString());
  }
}
