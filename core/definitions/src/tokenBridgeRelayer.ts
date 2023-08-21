import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, NativeAddress, ChainAddress } from "./address";
import { VAA } from "./vaa";
import { UnsignedTransaction } from "./unsignedTransaction";
import "./payloads/tokenBridge";

export interface TokenBridgeRelayer<P extends PlatformName> {
  //read-only:
  isWrappedAsset(token: UniversalOrNative<P>): Promise<boolean>;
  getOriginalAsset(token: UniversalOrNative<P>): Promise<ChainAddress>;
  hasWrappedAsset(original: ChainAddress): Promise<boolean>;
  getWrappedAsset(original: ChainAddress): Promise<NativeAddress<P>>;
  isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean>;
  //TODO bestEffortFindRedemptionTx()
  //signer required:
  createAttestation(
    address: UniversalOrNative<P>
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: initiateTransfer
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
}
