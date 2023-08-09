import { Platform } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, NativeAddress, ChainAddressPair } from "./address";
import { VAA } from "./vaa";
import { UnsignedTransaction } from "./unsignedTransaction";
import "./payloads/tokenBridge";

export interface TokenBridge<P extends Platform> {
  //read-only:
  isWrappedAsset(token: UniversalOrNative<P>): Promise<boolean>;
  getOriginalAsset(token: UniversalOrNative<P>): Promise<ChainAddressPair>;
  hasWrappedAsset(original: ChainAddressPair): Promise<boolean>;
  getWrappedAsset(original: ChainAddressPair): Promise<NativeAddress<P>>;
  isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean>;
  //TODO bestEffortFindRedemptionTx()
  //signer required:
  createAttestation(
    address: UniversalOrNative<P>
  ): AsyncGenerator<UnsignedTransaction>;
  submitAttestation(
    vaa: VAA<"AttestMeta">
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: initiateTransfer
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddressPair,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: completeTransfer
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
    unwrapNative?: boolean //default: true
  ): AsyncGenerator<UnsignedTransaction>;
}
