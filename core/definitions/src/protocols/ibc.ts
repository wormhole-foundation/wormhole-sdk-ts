import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";
import { RpcConnection } from "../rpc";

export interface SupportsIbcBridge<P extends PlatformName> {
  getIbcBridge(rpc: RpcConnection<P>): Promise<IbcBridge<P>>;
}

export function supportsIbcBridge<P extends PlatformName>(
  thing: SupportsIbcBridge<P> | any
): thing is SupportsIbcBridge<P> {
  return typeof (<SupportsIbcBridge<P>>thing).getIbcBridge === "function";
}

export interface IbcBridge<P extends PlatformName> {
  //alternative naming: initiateTransfer
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
}
