import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { SignedTx, TxHash } from "./types.js";
import type { UnsignedTransaction } from "./unsignedTransaction.js";

/**
 * A Signer is an interface that must be provided to certain methods
 * in the SDK to sign transactions. It can be either a SignOnlySigner
 * or a SignAndSendSigner depending on circumstances.
 * A Signer can be implemented by wrapping an existing offline wallet
 * or a web wallet
 */
export type Signer<N extends Network = Network, C extends Chain = Chain> =
  | SignOnlySigner<N, C>
  | SignAndSendSigner<N, C>;

export function isSigner(thing: any): thing is Signer<Network, Chain> {
  return isSignOnlySigner(thing) || isSignAndSendSigner(thing);
}

interface SignerBase<C extends Chain> {
  chain(): C;
  address(): string;
}

/**
 * A SignOnlySender is for situations where the signer is not
 * connected to the network or does not wish to broadcast the
 * transactions themselves
 */
export interface SignOnlySigner<N extends Network, C extends Chain> extends SignerBase<C> {
  sign(tx: UnsignedTransaction<N, C>[]): Promise<SignedTx[]>;
}

export function isSignOnlySigner(thing: any): thing is SignOnlySigner<Network, Chain> {
  return (
    typeof thing === "object" &&
    "chain" in thing &&
    typeof thing.chain === "function" &&
    "address" in thing &&
    typeof thing.address === "function" &&
    "sign" in thing &&
    typeof thing.sign === "function"
  );
}

/**
 * A SignAndSendSigner is for situations where the signer is
 * connected to the network and wishes to broadcast the
 * transactions themselves
 */
export interface SignAndSendSigner<N extends Network, C extends Chain> extends SignerBase<C> {
  signAndSend(tx: UnsignedTransaction<N, C>[]): Promise<TxHash[]>;
}

export function isSignAndSendSigner(thing: any): thing is SignAndSendSigner<Network, Chain> {
  return (
    typeof thing === "object" &&
    "chain" in thing &&
    typeof thing.chain === "function" &&
    "address" in thing &&
    typeof thing.address === "function" &&
    "signAndSend" in thing &&
    typeof thing.signAndSend === "function"
  );
}

export type NativeSigner = any;

/**
 * A PlatformNativeSigner should allow wrapping and unwrapping of a platform specific Signer
 * so that the underlying native signer may be used by unwrapping it where needed
 *
 */
export abstract class PlatformNativeSigner<
  NS extends NativeSigner,
  N extends Network = Network,
  C extends Chain = Chain,
> {
  constructor(
    protected _chain: C,
    protected _address: string,
    protected _signer: NS,
  ) {}
  unwrap(): NS {
    return this._signer;
  }

  // implement SignerBase
  abstract chain(): C;
  abstract address(): string;

  // implement Signer
  abstract sign(tx: UnsignedTransaction<N, C>[]): Promise<SignedTx[]>;
}

export function isNativeSigner(thing: any): thing is PlatformNativeSigner<any> {
  return isSigner(thing) && "unwrap" in thing && typeof thing.unwrap === "function";
}
