import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  ChainContext,
  NativeAddress,
  Network,
  UniversalOrNative,
} from '@wormhole-foundation/connect-sdk';
import { SolanaAddress } from './address';
import { AnySolanaAddress, SolanaChains, SolanaPlatformType } from './types';

export class SolanaChain<
  N extends Network,
  C extends SolanaChains = SolanaChains,
> extends ChainContext<N, SolanaPlatformType, C> {
  async getTokenAccount(
    token: UniversalOrNative<C> | 'native',
    address: AnySolanaAddress,
  ): Promise<NativeAddress<C>> {
    const tb = await this.getTokenBridge();

    const mintAddress: NativeAddress<C> =
      token === 'native'
        ? await tb.getWrappedNative()
        : token.toNative(this.chain);

    const mint = mintAddress.unwrap();
    const owner = new SolanaAddress(address).unwrap();

    const ata = await getAssociatedTokenAddress(mint, owner);
    return new SolanaAddress(ata.toString()) as NativeAddress<C>;
  }
}
