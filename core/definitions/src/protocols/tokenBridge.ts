import { Chain, Platform, PlatformToChains, lazyInstantiate } from "@wormhole-foundation/sdk-base";
import { AccountAddress, TokenAddress, NativeAddress, ChainAddress, UniversalOrNative } from "../address";
import { TokenId } from "../types";
import { ProtocolVAA, ProtocolPayload, payloadDiscriminator } from "../vaa";
import { UnsignedTransaction } from "../unsignedTransaction";
import "../payloads/tokenBridge";
import { RpcConnection } from "../rpc";

export const ErrNotWrapped = (token: string) =>
  new Error(`Token ${token} is not a wrapped asset`);

export interface SupportsTokenBridge<P extends Platform> {
  getTokenBridge(rpc: RpcConnection<P>): Promise<TokenBridge<P>>;
}

export function supportsTokenBridge<P extends Platform>(
  thing: SupportsTokenBridge<P> | any
): thing is SupportsTokenBridge<P> {
  return typeof (<SupportsTokenBridge<P>>thing).getTokenBridge === "function";
}

export interface SupportsAutomaticTokenBridge<P extends Platform> {
  getAutomaticTokenBridge(
    rpc: RpcConnection<P>
  ): Promise<AutomaticTokenBridge<P>>;
}

export function supportsAutomaticTokenBridge<P extends Platform>(
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

export interface TokenBridge<P extends Platform, C extends Chain = PlatformToChains<P>> {
  // checks a native address to see if its a wrapped version
  isWrappedAsset(nativeAddress: TokenAddress<C>): Promise<boolean>;
  // returns the original asset with its foreign chain
  getOriginalAsset(nativeAddress: TokenAddress<C>): Promise<TokenId<Chain>>;
  // returns the wrapped version of the native asset
  getWrappedNative(): Promise<NativeAddress<C>>;
  // Check to see if a foreign token has a wrapped version
  hasWrappedAsset(foreignToken: TokenId<Chain>): Promise<boolean>;
  // Returns the address of the native version of this asset
  getWrappedAsset(foreignToken: TokenId<Chain>): Promise<NativeAddress<C>>;
  // Checks if a transfer VAA has been redeemed
  isTransferCompleted(
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">
  ): Promise<boolean>;
  // Create a Token Attestation VAA containing metadata about
  // the token that may be submitted to a Token bridge on another chain 
  // to allow it to create a wrapped version of the token
  createAttestation(
    token: TokenAddress<C>,
    payer?: UniversalOrNative<C>
  ): AsyncGenerator<UnsignedTransaction>;
  // Submit the Token Attestation VAA to the Token bridge
  // to create the wrapped token represented by the data in the VAA
  submitAttestation(
    vaa: TokenBridge.VAA<"AttestMeta">,
    payer?: UniversalOrNative<C>
  ): AsyncGenerator<UnsignedTransaction>;
  // Initiate a transfer of some token to another chain
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array
  ): AsyncGenerator<UnsignedTransaction>;
  // Redeem a transfer VAA to receive the tokens on this chain
  redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"Transfer" | "TransferWithPayload">,
    unwrapNative?: boolean //default: true
  ): AsyncGenerator<UnsignedTransaction>;

  // TODO: preview (receive amount, fees, gas estimates, estimated blocks/time)
}

export interface AutomaticTokenBridge<P extends Platform, C extends Chain = PlatformToChains<P>> {
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    relayerFee: bigint,
    nativeGas?: bigint
  ): AsyncGenerator<UnsignedTransaction>;
  redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.VAA<"TransferWithPayload">
  ): AsyncGenerator<UnsignedTransaction>;
  getRelayerFee(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<Chain> | "native",
  ): Promise<bigint>;
  // the amount of native tokens a user would receive by swapping x amount of sending tokens
  // nativeTokenAmount(
  //   destChain: Chain | ChainId,
  //   token: TokenId,
  //   amount: BigNumber,
  //   walletAddress: string,
  // ): Promise<BigNumber>;

  // the maximum amount of sending tokens that can be swapped for native tokens
  // maxSwapAmount(
  //   destChain: Chain | ChainId,
  //   token: TokenId,
  //   walletAddress: string,
  // ): Promise<BigNumber>;
  // TODO: events (Redeem, Swap)
}
