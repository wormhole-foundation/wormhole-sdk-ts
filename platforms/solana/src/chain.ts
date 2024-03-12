import { getAssociatedTokenAddress } from '@solana/spl-token';
import type {
  ChainAddress,
  NativeAddress,
  Network,
  UniversalOrNative,
} from '@wormhole-foundation/sdk-connect';
import { ChainContext } from '@wormhole-foundation/sdk-connect';
import { SolanaAddress } from './address';
import type { SolanaChains } from './types';

export class SolanaChain<
  N extends Network,
  C extends SolanaChains = SolanaChains,
> extends ChainContext<N, C> {
  override async getTokenAccount(
    address: UniversalOrNative<C>,
    token: UniversalOrNative<C>,
  ): Promise<ChainAddress<C>> {
    const mint = new SolanaAddress(token).unwrap();
    const owner = new SolanaAddress(address).unwrap();

    const ata = await getAssociatedTokenAddress(mint, owner);
    return {
      chain: this.chain,
      address: new SolanaAddress(ata.toString()) as NativeAddress<C>,
    };
  }
}
