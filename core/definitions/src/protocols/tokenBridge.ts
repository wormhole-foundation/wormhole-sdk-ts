import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, NativeAddress, ChainAddress } from "../address";
import { TokenId } from "../types";
import { VAA } from "../vaa";
import { UnsignedTransaction } from "../unsignedTransaction";
import "../payloads/tokenBridge";

export const ErrNotWrapped = (token: string) =>
  new Error(`Token ${token} is not a wrapped asset`);

export interface TokenBridge<P extends PlatformName> {
  //read-only:
  isWrappedAsset(token: UniversalOrNative<P>): Promise<boolean>;
  getOriginalAsset(token: UniversalOrNative<P>): Promise<TokenId>;
  hasWrappedAsset(original: ChainAddress): Promise<boolean>;
  getWrappedAsset(original: ChainAddress): Promise<NativeAddress<P>>;
  getWrappedNative(): Promise<TokenId>;
  isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean>;
  //signer required:
  createAttestation(
    token: UniversalOrNative<P>,
    sender?: UniversalOrNative<P>
  ): AsyncGenerator<UnsignedTransaction>;
  submitAttestation(
    vaa: VAA<"AttestMeta">,
    sender?: UniversalOrNative<P>
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: initiateTransfer
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
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

export interface AutomaticTokenBridge<P extends PlatformName> {
  transfer(
    sender: UniversalOrNative<P>,
    recipient: ChainAddress,
    token: UniversalOrNative<P> | "native",
    amount: bigint,
    relayerFee: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: UniversalOrNative<P>,
    vaa: VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
  getRelayerFee(
    sender: ChainAddress,
    recipient: ChainAddress,
    token: TokenId | "native"
  ): Promise<bigint>;
}
