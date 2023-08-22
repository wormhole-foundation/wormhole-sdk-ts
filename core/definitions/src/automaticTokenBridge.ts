import { PlatformName } from "@wormhole-foundation/sdk-base";
import { VAA } from "./vaa";
import { UniversalOrNative, ChainAddress } from "./address";
import { UnsignedTransaction } from "./unsignedTransaction";
import "./payloads/tokenBridge";

export interface AutomaticTokenBridge<P extends PlatformName> {
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
}
