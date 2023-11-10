import { Platform } from "@wormhole-foundation/sdk-base";
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

export class MockTokenBridge<P extends Platform> implements TokenBridge<P> {
  constructor(readonly rpc: RpcConnection<P>) {}

  isWrappedAsset(token: TokenAddress<P>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getOriginalAsset(token: TokenAddress<P>): Promise<ChainAddress> {
    throw new Error("Method not implemented.");
  }
  hasWrappedAsset(original: ChainAddress): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async getWrappedAsset(original: ChainAddress): Promise<NativeAddress<P>> {
    throw new Error("Method not implemented.");
  }
  isTransferCompleted(vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  createAttestation(address: TokenAddress<P>): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  submitAttestation(vaa: TokenBridge.VAA<"AttestMeta">): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  transfer(
    sender: TokenAddress<P>,
    recipient: ChainAddress,
    token: TokenAddress<P>,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  redeem(
    sender: TokenAddress<P>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  getWrappedNative(): Promise<NativeAddress<P>> {
    throw new Error("Method not implemented.");
  }
}
