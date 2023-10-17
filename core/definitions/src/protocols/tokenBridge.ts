import { PlatformName } from "@wormhole-foundation/sdk-base";
import { NativeAddress, ChainAddress } from "../address";
import { AnyAddress, TokenId } from "../types";
import { VAA } from "../vaa";
import { UnsignedTransaction } from "../unsignedTransaction";
import "../payloads/tokenBridge";
import { RpcConnection } from "../rpc";

export const ErrNotWrapped = (token: string) =>
  new Error(`Token ${token} is not a wrapped asset`);

export interface SupportsTokenBridge<P extends PlatformName> {
  getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>>;
}

export function supportsTokenBridge<P extends PlatformName>(
  thing: SupportsTokenBridge<P> | any
): thing is SupportsTokenBridge<P> {
  return typeof (<SupportsTokenBridge<P>>thing).getTokenBridge === "function";
}

export interface SupportsAutomaticTokenBridge<P extends PlatformName> {
  getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>>;
}

export function supportsAutomaticTokenBridge<P extends PlatformName>(
  thing: SupportsAutomaticTokenBridge<P> | any
): thing is SupportsAutomaticTokenBridge<P> {
  return (
    typeof (<SupportsAutomaticTokenBridge<P>>thing).getAutomaticTokenBridge ===
    "function"
  );
}

export interface TokenBridge<P extends PlatformName> {
  // checks a native address to see if its a wrapped version
  isWrappedAsset(nativeAddress: AnyAddress): Promise<boolean>;
  // returns the original asset with its foreign chain
  getOriginalAsset(nativeAddress: AnyAddress): Promise<TokenId>;
  // returns the wrapped version of the native asset
  getWrappedNative(): Promise<NativeAddress<P>>;

  // Check to see if a foreign token has a wrapped version
  hasWrappedAsset(foreignToken: TokenId): Promise<boolean>;
  // Returns the address of the native version of this asset
  getWrappedAsset(foreignToken: TokenId): Promise<NativeAddress<P>>;

  // TODO: preview (receive amount, fees, gas estimates, estimated blocks/time)
  isTransferCompleted(
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">
  ): Promise<boolean>;
  //signer required:
  createAttestation(
    token_to_attest: AnyAddress,
    payer?: AnyAddress
  ): AsyncGenerator<UnsignedTransaction>;
  submitAttestation(
    vaa: VAA<"AttestMeta">,
    payer?: AnyAddress
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: initiateTransfer
  transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: AnyAddress | "native",
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
  //alternative naming: completeTransfer
  redeem(
    sender: AnyAddress,
    vaa: VAA<"Transfer"> | VAA<"TransferWithPayload">,
    unwrapNative?: boolean //default: true
  ): AsyncGenerator<UnsignedTransaction>;
  // TODO: parse transaction
}

export interface AutomaticTokenBridge<P extends PlatformName> {
  transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: AnyAddress | "native",
    amount: bigint,
    relayerFee: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: AnyAddress,
    vaa: VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
  getRelayerFee(
    sender: ChainAddress,
    recipient: ChainAddress,
    token: TokenId | "native"
  ): Promise<bigint>;
  // the amount of native tokens a user would receive by swapping x amount of sending tokens
  // nativeTokenAmount(
  //   destChain: ChainName | ChainId,
  //   token: TokenId,
  //   amount: BigNumber,
  //   walletAddress: string,
  // ): Promise<BigNumber>;

  // the maximum amount of sending tokens that can be swapped for native tokens
  // maxSwapAmount(
  //   destChain: ChainName | ChainId,
  //   token: TokenId,
  //   walletAddress: string,
  // ): Promise<BigNumber>;
  // TODO: events (Redeem, Swap)
}
