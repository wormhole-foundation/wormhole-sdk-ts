import type { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  NativeAddress,
  RpcConnection,
  TokenAddress,
  TokenBridge,
  UniversalAddress,
  UnsignedTransaction,
} from "./../../index.js";

export class MockTokenBridge<N extends Network, P extends Platform, C extends PlatformToChains<P>>
  implements TokenBridge<N, C>
{
  constructor(readonly rpc: RpcConnection<P>) {}

  isWrappedAsset(token: TokenAddress<C>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getOriginalAsset(token: TokenAddress<C>): Promise<ChainAddress> {
    throw new Error("Method not implemented.");
  }
  getTokenUniversalAddress(token: NativeAddress<C>): Promise<UniversalAddress> {
    throw new Error("Method not implemented.");
  }
  getTokenNativeAddress(originChain: Chain, token: UniversalAddress): Promise<NativeAddress<C>> {
    throw new Error("Method not implemented.");
  }
  hasWrappedAsset(original: ChainAddress): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  async getWrappedAsset(original: ChainAddress): Promise<NativeAddress<C>> {
    throw new Error("Method not implemented.");
  }
  isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  createAttestation(address: TokenAddress<C>): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  submitAttestation(vaa: TokenBridge.AttestVAA): AsyncGenerator<UnsignedTransaction<N, C>> {
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
    vaa: TokenBridge.TransferVAA,
    unwrapNative?: boolean | undefined,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  getWrappedNative(): Promise<NativeAddress<C>> {
    throw new Error("Method not implemented.");
  }
}
