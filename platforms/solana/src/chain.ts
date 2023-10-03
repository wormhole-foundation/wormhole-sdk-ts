import { PublicKey } from '@solana/web3.js';
import {
  ChainContext,
  NativeAddress,
  UniversalAddress,
  UniversalOrNative,
  Platform,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { SolanaPlatform } from './platform';

export class SolanaChain extends ChainContext<'Solana'> {
  // @ts-ignore
  readonly platform = SolanaPlatform;

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
    return toNative('Solana', ata.toString());
  }
}
