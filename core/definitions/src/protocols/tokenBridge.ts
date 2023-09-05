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
  isWrappedAsset(maybe_native_token: UniversalOrNative<P>): Promise<boolean>;
  hasWrappedAsset(original_token: TokenId): Promise<boolean>;
  getWrappedAsset(original_token: TokenId): Promise<TokenId>;
  getOriginalAsset(native_token: UniversalOrNative<P>): Promise<TokenId>;
  getWrappedNative(): Promise<TokenId>;
  isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean>;
  //signer required:
  createAttestation(
    token_to_attest: UniversalOrNative<P>,
    payer?: UniversalOrNative<P>
  ): AsyncGenerator<UnsignedTransaction>;
  submitAttestation(
    vaa: VAA<"AttestMeta">,
    payer?: UniversalOrNative<P>
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
