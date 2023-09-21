import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";
import { RpcConnection } from "../rpc";

export interface SupportsWormholeCore<P extends PlatformName> {
  getWormholeCore(rpc: RpcConnection<P>): Promise<WormholeCore<P>>;
}

export function supportsWormholeCore<P extends PlatformName>(
  thing: SupportsWormholeCore<P> | any
): thing is SupportsWormholeCore<P> {
  return typeof (<SupportsWormholeCore<P>>thing).getWormholeCore === "function";
}

export interface WormholeCore<P extends PlatformName> {
  publishMessage(
    sender: UniversalOrNative<P>,
    message: string | Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
}
