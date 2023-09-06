import { PlatformName } from "@wormhole-foundation/sdk-base";
import { UniversalOrNative, NativeAddress, ChainAddress } from "../address";
import { TokenId } from "../types";
import { VAA } from "../vaa";
import { UnsignedTransaction } from "../unsignedTransaction";
import "../payloads/tokenBridge";

export const ErrNotWrapped = (token: string) =>
  new Error(`Token ${token} is not a wrapped asset`);

export interface TokenBridge<P extends PlatformName> {
  // checks a native address to see if its a wrapped version
  isWrappedAsset(nativeAddress: UniversalOrNative<P>): Promise<boolean>;
  // returns the original asset with its foreign chain
  getOriginalAsset(nativeAddress: UniversalOrNative<P>): Promise<TokenId>;
  // returns the wrapped version of the native asset
  getWrappedNative(): Promise<NativeAddress<P>>;

  // Check to see if a foreign token has a wrapped version
  hasWrappedAsset(foreignToken: TokenId): Promise<boolean>;
  // Returns the address of the native version of this asset
  getWrappedAsset(foreignToken: TokenId): Promise<NativeAddress<P>>;

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
