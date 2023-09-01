import {
  ChainAddress,
  NativeAddress,
  TokenBridge,
  TokenId,
  UniversalOrNative,
  UnsignedTransaction,
  VAA,
} from '@wormhole-foundation/sdk-definitions';

type P = 'Evm';

export class MockTokenBridge implements TokenBridge<P> {
  isWrappedAsset(token: UniversalOrNative<P>): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getOriginalAsset(token: UniversalOrNative<P>): Promise<ChainAddress> {
    throw new Error('Method not implemented.');
  }
  hasWrappedAsset(original: ChainAddress): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  async getWrappedAsset(original: ChainAddress): Promise<NativeAddress<P>> {
    throw new Error('Method not implemented.');
  }
  isTransferCompleted(
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  createAttestation(
    address: UniversalOrNative<'Evm'>,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  transfer(
    sender: UniversalOrNative<'Evm'>,
    recipient: ChainAddress,
    token: 'native' | UniversalOrNative<'Evm'>,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  redeem(
    sender: UniversalOrNative<'Evm'>,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  getWrappedNative(): Promise<TokenId> {
    throw new Error('Method not implemented.');
  }
}
