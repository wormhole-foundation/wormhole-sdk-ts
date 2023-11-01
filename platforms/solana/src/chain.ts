import {
  ChainContext,
  NativeAddress,
  UniversalOrNative,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { SolanaPlatform } from './platform';
import { AnySolanaAddress } from './types';
import { SolanaAddress } from './address';

export class SolanaChain extends ChainContext<'Solana'> {
  // @ts-ignore
  readonly platform = SolanaPlatform;

  async getTokenAccount(
    token: UniversalOrNative<'Solana'> | 'native',
    address: AnySolanaAddress,
  ): Promise<NativeAddress<'Solana'>> {
    const tb = await this.getTokenBridge();

    const mintAddress: UniversalOrNative<'Solana'> =
      token === 'native'
        ? await tb.getWrappedNative()
        : token.toUniversalAddress();

    const mint = new SolanaAddress(mintAddress.toUint8Array()).unwrap();
    const owner = new SolanaAddress(address).unwrap();

    const ata = await getAssociatedTokenAddress(mint, owner);
    return toNative('Solana', ata.toString());
  }
}
