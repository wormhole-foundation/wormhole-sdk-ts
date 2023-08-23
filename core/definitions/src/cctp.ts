import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, NativeAddress, ChainAddress } from "./address";
import { VAA } from "./vaa";
import { UnsignedTransaction } from "./unsignedTransaction";
import "./payloads/tokenBridge";

//https://github.com/circlefin/evm-cctp-contracts

export interface CCTP<P extends PlatformName> {
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
}
