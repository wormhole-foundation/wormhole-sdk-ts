import { PublicKey } from '@solana/web3.js';
import {
  ChainContext,
  NativeAddress,
  UniversalAddress,
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
    token: AnySolanaAddress | 'native',
    address: UniversalAddress,
  ): Promise<NativeAddress<'Solana'>> {
    const tb = await this.getTokenBridge();

    const mintAddress =
      token === 'native'
        ? await tb.getWrappedNative()
        : new SolanaAddress(token);

    const mint = new PublicKey(mintAddress.toUint8Array());
    const owner = new PublicKey(address.toUint8Array());

    const ata = await getAssociatedTokenAddress(mint, owner);
    return toNative('Solana', ata.toString());
  }
}
