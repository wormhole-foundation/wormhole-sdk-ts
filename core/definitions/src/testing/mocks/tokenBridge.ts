import { PlatformToChains, Network, Platform } from "@wormhole-foundation/sdk-base";
import {
  TokenAddress,
  ChainAddress,
  NativeAddress,
  RpcConnection,
  TokenBridge,
  UnsignedTransaction,
} from "../..";

//export function mockTokenBridgeFactory(
//  p: Platform,
//): TokenBridge<Platform> {
//  return new MockTokenBridge(p);
//}

export class MockTokenBridge<N extends Network, P extends Platform, C extends PlatformToChains<P>>
  implements TokenBridge<N, P, C>
{
  constructor(readonly rpc: RpcConnection<P>) {}

  isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getOriginalAsset(token: TokenAddress<C>): Promise<ChainAddress> {
    throw new Error("Method not implemented.");
  }
  hasWrappedAsset(original: ChainAddress): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async getWrappedAsset(original: ChainAddress): Promise<NativeAddress<C>> {
    throw new Error("Method not implemented.");
  }
  isTransferCompleted(vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  createAttestation(address: TokenAddress<C>): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  submitAttestation(vaa: TokenBridge.VAA<"AttestMeta">): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  transfer(
    sender: TokenAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  redeem(
    sender: TokenAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  getWrappedNative(): Promise<NativeAddress<C>> {
    throw new Error("Method not implemented.");
  }
}
