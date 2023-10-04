import { PlatformName } from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  NativeAddress,
  RpcConnection,
  TokenBridge,
  TokenId,
  UniversalOrNative,
  UnsignedTransaction,
  VAA,
} from '../..';

//export function mockTokenBridgeFactory(
//  p: PlatformName,
//): TokenBridge<PlatformName> {
//  return new MockTokenBridge(p);
//}

export class MockTokenBridge<P extends PlatformName> implements TokenBridge<P> {
  constructor(readonly rpc: RpcConnection<P>) {}

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
    address: UniversalOrNative<P>,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  submitAttestation(
    vaa: VAA<'AttestMeta'>,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: 'native' | UniversalOrNative<P>,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<'Transfer'> | VAA<'TransferWithPayload'>,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error('Method not implemented.');
  }
  getWrappedNative(): Promise<NativeAddress<P>> {
    throw new Error('Method not implemented.');
  }
}
