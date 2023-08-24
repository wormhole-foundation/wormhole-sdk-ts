import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, ChainAddress } from "../address";
import { UnsignedTransaction } from "../unsignedTransaction";
import { VAA } from "../vaa";

//https://github.com/circlefin/evm-cctp-contracts

export interface WormholeCircleRelayer<P extends PlatformName> {
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
}

export interface CircleBridge<P extends PlatformName> {
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
  transfer(
    token: ChainAddress,
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    amount: bigint
  ): AsyncGenerator<UnsignedTransaction>;
}
