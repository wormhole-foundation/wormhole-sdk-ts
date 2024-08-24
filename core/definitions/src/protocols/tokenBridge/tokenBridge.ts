import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { lazyInstantiate } from "@wormhole-foundation/sdk-base";
import type { AccountAddress, ChainAddress, NativeAddress } from "../../address.js";
import type { UniversalAddress } from "../../universalAddress.js";
import type { TokenAddress, TokenId } from "../../types.js";
import type { UnsignedTransaction } from "../../unsignedTransaction.js";
import type { ProtocolPayload, ProtocolVAA } from "./../../vaa/index.js";
import { payloadDiscriminator } from "./../../vaa/index.js";
import "./automaticTokenBridgeLayout.js";
import "./tokenBridgeLayout.js";

export const ErrNotWrapped = (token: string) => new Error(`Token ${token} is not a wrapped asset`);

import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      TokenBridge: TokenBridge<N, C>;
      AutomaticTokenBridge: AutomaticTokenBridge<N, C>;
    }
    interface ProtocolToPlatformMapping {
      TokenBridge: EmptyPlatformMap<"TokenBridge">;
      AutomaticTokenBridge: EmptyPlatformMap<"AutomaticTokenBridge">;
    }
  }
}

/**
 * @namespace TokenBridge
 */
export namespace TokenBridge {
  const _protocol = "TokenBridge";
  /** The compile time type of the TokenBridge protocol */
  export type ProtocolName = typeof _protocol;

  const _transferPayloads = ["Transfer", "TransferWithPayload"] as const;
  const _attestPayloads = ["AttestMeta"] as const;
  const _payloads = [..._transferPayloads, ..._attestPayloads] as const;

  export type TransferPayloadNames = (typeof _transferPayloads)[number];
  export type AttestPayloadNames = (typeof _attestPayloads)[number];
  export type PayloadNames = (typeof _payloads)[number];

  export type TransferVAA<PayloadName extends TransferPayloadNames = TransferPayloadNames> =
    ProtocolVAA<ProtocolName, PayloadName>;
  export type AttestVAA<PayloadName extends AttestPayloadNames = AttestPayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  /** The VAAs emitted from the TokenBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;

  export type TransferPayload<PayloadName extends TransferPayloadNames = TransferPayloadNames> =
    ProtocolPayload<ProtocolName, PayloadName>;
  export type AttestPayload<PayloadName extends AttestPayloadNames = AttestPayloadNames> =
    ProtocolPayload<ProtocolName, PayloadName>;
  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;

  export const getTransferDiscriminator = lazyInstantiate(() =>
    payloadDiscriminator([_protocol, _transferPayloads]),
  );
}

export namespace AutomaticTokenBridge {
  const _protocol = "AutomaticTokenBridge";
  /** The compile time type of the AutomaticTokenBridge protocol */
  export type ProtocolName = typeof _protocol;

  const _payloads = ["TransferWithRelay"] as const;

  export type PayloadNames = (typeof _payloads)[number];

  /** The VAAs emitted from the AutomaticTokenBridge protocol */
  export type VAA<PayloadName extends PayloadNames = PayloadNames> = ProtocolVAA<
    ProtocolName,
    PayloadName
  >;
  export type Payload<PayloadName extends PayloadNames = PayloadNames> = ProtocolPayload<
    ProtocolName,
    PayloadName
  >;
}

/**
 * Details of a token transfer, used to initiate a transfer
 */
export type TokenTransferDetails = {
  token: TokenId;
  amount: bigint;
  from: ChainAddress;
  to: ChainAddress;
  automatic?: boolean;
  payload?: Uint8Array;
  nativeGas?: bigint;
};

export function isTokenTransferDetails(
  thing: TokenTransferDetails | any,
): thing is TokenTransferDetails {
  return (
    (<TokenTransferDetails>thing).token !== undefined &&
    (<TokenTransferDetails>thing).amount !== undefined &&
    (<TokenTransferDetails>thing).from !== undefined &&
    (<TokenTransferDetails>thing).to !== undefined
  );
}

/**
 * TokenBridge protocol definition, providing a consistent client interface
 * for the TokenBridge protocol
 *
 * Find details on the TokenBridge protocol here: {@link https://github.com/wormhole-foundation/wormhole/blob/main/whitepapers/0003_token_bridge.md}
 *
 */
export interface TokenBridge<N extends Network = Network, C extends Chain = Chain> {
  /** Checks a native address to see if its a wrapped version
   *
   * @param nativeAddress The address to check
   * @returns true if the address is a wrapped version of a foreign token
   */
  isWrappedAsset(nativeAddress: TokenAddress<C>): Promise<boolean>;
  /**
   * returns the original asset with its foreign chain
   *
   * @param nativeAddress The wrapped address to check
   * @returns The TokenId corresponding to the original asset and chain
   */
  getOriginalAsset(nativeAddress: TokenAddress<C>): Promise<TokenId<Chain>>;
  /**
   * Returns the UniversalAddress of the token. This may require fetching on-chain data.
   *
   * @param token The address to get the UniversalAddress for
   * @returns The UniversalAddress of the token
   */
  getTokenUniversalAddress(token: NativeAddress<C>): Promise<UniversalAddress>;
  /**
   * Returns the native address of the token. This may require fetching on-chain data.
   * @param originChain The chain the token is from / native to
   * @param token The address to get the native address for
   * @returns The native address of the token
   */
  getTokenNativeAddress(originChain: Chain, token: UniversalAddress): Promise<NativeAddress<C>>;
  /**
   * returns the wrapped version of the native asset
   *
   * @returns The address of the native gas token that has been wrapped
   * for use where the gas token is not possible to use (e.g. bridging)
   */
  getWrappedNative(): Promise<NativeAddress<C>>;
  /**
   * Check to see if a foreign token has a wrapped version
   *
   * @param foreignToken The token to check
   * @returns true if the token has a wrapped version
   */
  hasWrappedAsset(foreignToken: TokenId<Chain>): Promise<boolean>;
  /**
   * Returns the address of the native version of this asset
   *
   * @param foreignToken The token to check
   * @returns The address of the native version of this asset
   */
  getWrappedAsset(foreignToken: TokenId<Chain>): Promise<TokenAddress<C>>;
  /**
   * Checks if a transfer VAA has been redeemed
   *
   * @param vaa The transfer VAA to check
   * @returns true if the transfer has been redeemed
   */
  isTransferCompleted(vaa: TokenBridge.TransferVAA): Promise<boolean>;
  /**
   * Create a Token Attestation VAA containing metadata about
   * the token that may be submitted to a Token bridge on another chain
   * to allow it to create a wrapped version of the token
   *
   * @param token The token to create an attestation for
   * @param payer The payer of the transaction
   * @returns An AsyncGenerator that produces transactions to sign and send
   */
  createAttestation(
    token: TokenAddress<C>,
    payer?: AccountAddress<C>,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /**
   * Submit the Token Attestation VAA to the Token bridge
   * to create the wrapped token represented by the data in the VAA
   * @param vaa The attestation VAA to submit
   * @param payer The payer of the transaction
   * @returns An AsyncGenerator that produces transactions to sign and send
   */
  submitAttestation(
    vaa: TokenBridge.AttestVAA,
    payer?: AccountAddress<C>,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /**
   * Initiate a transfer of some token to another chain
   *
   * @param sender The sender of the transfer
   * @param recipient The recipient of the transfer as a ChainAddress so we know what the destination chain should be
   * @param token The token to transfer
   * @param amount The amount of the token to transfer
   * @param payload Optional payload to include in the transfer
   * @returns An AsyncGenerator that produces transactions to sign and send
   */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    payload?: Uint8Array,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;

  /**
   * Redeem a transfer VAA to receive the tokens on this chain
   *
   * @param sender The sender of the transfer
   * @param vaa The transfer VAA to redeem
   * @param unwrapNative Whether to unwrap the native token if it is a wrapped token
   * @returns An AsyncGenerator that produces transactions to sign and send
   */
  redeem(
    sender: AccountAddress<C>,
    vaa: TokenBridge.TransferVAA,
    unwrapNative?: boolean,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
}

/**
 *  AutomaticTokenBridge provides a consistent interface to the
 *  TokenBridge with Automatic redemption on the destination chain
 */
export interface AutomaticTokenBridge<N extends Network = Network, C extends Chain = Chain> {
  /** Initiate the transfer over the automatic bridge */
  transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /**
   * Manually redeem a transfer, should not be used unless
   * necessary to take over some stalled transfer
   */
  redeem(
    sender: AccountAddress<C>,
    vaa: AutomaticTokenBridge.VAA,
  ): AsyncGenerator<UnsignedTransaction<N, C>>;
  /** Fee charged to relay */
  getRelayerFee(destination: Chain, token: TokenAddress<C>): Promise<bigint>;
  /** Check if a given token is in the registered token list */
  isRegisteredToken(token: TokenAddress<C>): Promise<boolean>;
  /**  Get the list of tokens that are registered and acceptable to send */
  getRegisteredTokens(): Promise<TokenAddress<C>[]>;
  /** Amount of native tokens a user would receive by swapping x amount of sending tokens */
  nativeTokenAmount(token: TokenAddress<C>, amount: bigint): Promise<bigint>;
  /** Maximum amount of sending tokens that can be swapped for native tokens */
  maxSwapAmount(token: TokenAddress<C>): Promise<bigint>;
}
