import { Chain, PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative } from "./address";

export interface Relayer<P extends PlatformName> {
  relaySupported(chain: Chain): boolean;
  getRelayerFee(
    sourceChain: Chain,
    destChain: Chain,
    tokenId: UniversalOrNative<P>
  ): Promise<bigint>;
  // TODO: What should this be named?
  // I don't think it should return an UnisgnedTransaction
  // rather it should take some signing callbacks and
  // a ref to track the progress
  startTransferWithRelay(
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    toNativeToken: string,
    sendingChain: Chain,
    senderAddress: string,
    recipientChain: Chain,
    recipientAddress: string,
    overrides?: any
  ): Promise<any>;
  calculateNativeTokenAmt(
    destChain: Chain,
    tokenId: UniversalOrNative<P>,
    amount: bigint,
    walletAddress: string
  ): Promise<bigint>;
  calculateMaxSwapAmount(
    destChain: Chain,
    tokenId: UniversalOrNative<P>,
    walletAddress: string
  ): Promise<bigint>;
}

//function parseRelayerPayload(transferPayload: Buffer): ParsedRelayerPayload {
//  return {
//    relayerPayloadId: transferPayload.readUint8(0),
//    relayerFee: BigNumber.from(
//      "0x" + transferPayload.subarray(1, 33).toString("hex")
//    ),
//    toNativeTokenAmount: BigNumber.from(
//      "0x" + transferPayload.subarray(33, 65).toString("hex")
//    ),
//    to: "0x" + transferPayload.subarray(65, 98).toString("hex"),
//  };
//}
//
