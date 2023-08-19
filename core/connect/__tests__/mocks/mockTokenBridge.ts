import { EvmAddress } from '@wormhole-foundation/connect-sdk-evm';
import { PlatformName } from '@wormhole-foundation/sdk-base';
import {
  ChainAddressPair,
  NativeAddress,
  TokenBridge,
  UniversalOrNative,
  UnsignedTransaction,
  VAA,
} from '@wormhole-foundation/sdk-definitions';

export class MockTokenBridge implements TokenBridge<'Evm'> {
  isWrappedAsset(token: UniversalOrNative<'Evm'>): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getOriginalAsset(token: UniversalOrNative<'Evm'>): Promise<ChainAddressPair> {
    throw new Error('Method not implemented.');
  }
  hasWrappedAsset(original: ChainAddressPair): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  async getWrappedAsset(
    original: ChainAddressPair,
  ): Promise<NativeAddress<PlatformName>> {
    throw new Error('Method not implemented.');
  }
  isTransferCompleted(
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
  ): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  createAttestation(
    address: UniversalOrNative<'Evm'>,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error('Method not implemented.');
  }
  submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error('Method not implemented.');
  }
  transfer(
    sender: UniversalOrNative<'Evm'>,
    recipient: ChainAddressPair,
    token: 'native' | UniversalOrNative<'Evm'>,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error('Method not implemented.');
  }
  redeem(
    sender: UniversalOrNative<'Evm'>,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error('Method not implemented.');
  }
}
