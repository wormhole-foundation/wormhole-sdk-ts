import { PlatformName, lazyInstantiate } from "@wormhole-foundation/sdk-base";
import { NativeAddress, ChainAddress } from "../address";
import { AnyAddress, TokenId } from "../types";
import { ProtocolVAA, ProtocolPayload, payloadDiscriminator } from "../vaa";
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

export namespace TokenBridge {
  export type VAA<PayloadName extends string> = ProtocolVAA<"TokenBridge", PayloadName>;
  export type Payload<PayloadName extends string> = ProtocolPayload<"TokenBridge", PayloadName>;

  // export const transferPayloadNames = ["Transfer", "TransferWithPayload"] as const;
  // export type TransferPayloadNames = typeof transferPayloadNames[number];

  export const getTransferDiscriminator = lazyInstantiate(
    () => payloadDiscriminator(["TokenBridge", ["Transfer", "TransferWithPayload"]])
  );
}

export interface TokenBridge<P extends PlatformName> {
  // checks a native address to see if its a wrapped version
  isWrappedAsset(nativeAddress: AnyAddress | bigint): Promise<boolean>;
  // returns the original asset with its foreign chain
  getOriginalAsset(nativeAddress: AnyAddress | bigint): Promise<TokenId>;
  // returns the wrapped version of the native asset
  getWrappedNative(): Promise<NativeAddress<P>>;
  // Check to see if a foreign token has a wrapped version
  hasWrappedAsset(foreignToken: TokenId): Promise<boolean>;
  // Returns the address of the native version of this asset
  getWrappedAsset(foreignToken: TokenId): Promise<NativeAddress<P>>;
  // Checks if a transfer VAA has been redeemed
  isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">
  ): Promise<boolean>;
  // Create a Token Attestation VAA containing metadata about
  // the token that may be submitted to a Token bridge on another chain 
  // to allow it to create a wrapped version of the token
  createAttestation(
    token_to_attest: AnyAddress | bigint,
    payer?: AnyAddress
  ): AsyncGenerator<UnsignedTransaction>;
  // Submit the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    payer?: AnyAddress
  ): AsyncGenerator<UnsignedTransaction>;
  // Initiate a transfer of some token to another chain
  transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: AnyAddress | bigint,
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
  // Redeem a transfer VAA to receive the tokens on this chain
  redeem(
    sender: AnyAddress,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative?: boolean //default: true
  ): AsyncGenerator<UnsignedTransaction>;

  // TODO: preview (receive amount, fees, gas estimates, estimated blocks/time)
}

export interface AutomaticTokenBridge<P extends PlatformName> {
  transfer(
    sender: AnyAddress,
    recipient: ChainAddress,
    token: AnyAddress,
    amount: bigint,
    relayerFee: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: AnyAddress,
    vaa: TokenBridge.VAA<"TransferWithPayload">
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
