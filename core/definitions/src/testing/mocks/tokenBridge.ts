import { Platform } from "@wormhole-foundation/sdk-base";
import {
  AnyAddress,
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

  isWrappedAsset(token: AnyAddress): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getOriginalAsset(token: AnyAddress): Promise<ChainAddress> {
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
  createAttestation(address: AnyAddress): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  submitAttestation(vaa: TokenBridge.VAA<"AttestMeta">): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: "native" | AnyAddress,
    amount: bigint,
    payload?: Uint8Array | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  redeem(
    sender: AnyAddress,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction> {
    throw new Error("Method not implemented.");
  }
  getWrappedNative(): Promise<NativeAddress<P>> {
    throw new Error("Method not implemented.");
  }
}
