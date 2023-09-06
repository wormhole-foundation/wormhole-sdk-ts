import { PublicKey } from '@solana/web3.js';
import {
  ChainName,
  ChainContext,
  NativeAddress,
  RpcConnection,
  TokenId,
  UniversalAddress,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';
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
    token: UniversalOrNative<'Solana'> | 'native',
    address: UniversalAddress,
  ): Promise<NativeAddress<'Solana'>> {
    const tb = await this.getTokenBridge();

    const mintAddress: UniversalOrNative<'Solana'> =
      token === 'native'
        ? await tb.getWrappedNative()
        : token.toUniversalAddress();

    const mint = new PublicKey(mintAddress.toUint8Array());
    const owner = new PublicKey(address.toUint8Array());

    const ata = await getAssociatedTokenAddress(mint, owner);
    return this.parseAddress(ata.toString());
  }
}
