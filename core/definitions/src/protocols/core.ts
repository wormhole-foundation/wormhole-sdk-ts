import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";

export interface WormholeCore<P extends PlatformName> {
  publishMessage(
    sender: UniversalOrNative<P>,
    message: string | Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
}
