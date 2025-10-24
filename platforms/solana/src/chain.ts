import type {
  ChainAddress,
  NativeAddress,
  Network,
  TokenAddress,
  UniversalOrNative,
} from '@wormhole-foundation/sdk-connect';
import { ChainContext, isNative } from '@wormhole-foundation/sdk-connect';
import { SolanaAddress } from './address.js';
import type { SolanaChains } from './types.js';
import { SolanaPlatform } from './platform.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

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

  override async isToken2022(token: TokenAddress<C>): Promise<boolean> {
    if (isNative(token)) return false;

    const mint = new SolanaAddress(token).unwrap();
    const rpc = await this.getRpc();
    const tokenProgram = await SolanaPlatform.getTokenProgramId(rpc, mint);

    return tokenProgram.equals(TOKEN_2022_PROGRAM_ID);
  }
}
