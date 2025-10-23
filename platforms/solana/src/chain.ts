import type {
  ChainAddress,
  NativeAddress,
  Network,
  UniversalOrNative,
} from '@wormhole-foundation/sdk-connect';
import { ChainContext } from '@wormhole-foundation/sdk-connect';
import { SolanaAddress } from './address.js';
import type { SolanaChains } from './types.js';
import { SolanaPlatform } from './platform.js';

export class SolanaChain<
  N extends Network = Network,
  C extends SolanaChains = SolanaChains,
> extends ChainContext<N, C> {
  override async getTokenAccount(
    address: UniversalOrNative<C>,
    token: UniversalOrNative<C>,
  ): Promise<ChainAddress<C>> {
    const { getAssociatedTokenAddress } = await import('@solana/spl-token');
    const mint = new SolanaAddress(token).unwrap();
    const owner = new SolanaAddress(address).unwrap();
    const rpc = await this.getRpc();
    const tokenProgram = await SolanaPlatform.getTokenProgramId(rpc, mint);

    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      tokenProgram,
    );
    return {
      chain: this.chain,
      address: new SolanaAddress(ata.toString()) as NativeAddress<C>,
    };
  }
}
