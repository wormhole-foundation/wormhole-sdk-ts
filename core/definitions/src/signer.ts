import { Chain } from "@wormhole-foundation/sdk-base";
import { SignedTx, TxHash } from "./types";
import { UnsignedTransaction } from "./unsignedTransaction";

// A Signer is an interface that must be provided to certain methods
// in the SDK to sign transactions. It can be either a SignOnlySigner
// or a SignAndSendSigner depending on circumstances.
// A Signer can be implemented by wrapping an existing offline wallet
// or a web wallet
export type Signer<C extends Chain> = SignOnlySigner<C> | SignAndSendSigner<C>;

export function isSigner(thing: any): thing is Signer<Chain> {
  return isSignOnlySigner(thing) || isSignAndSendSigner(thing);
}

interface SignerBase<C extends Chain> {
  chain(): C;
  address(): string;
}

// A SignOnlySender is for situations where the signer is not
// connected to the network or does not wish to broadcast the
// transactions themselves
export interface SignOnlySigner<C extends Chain> extends SignerBase<C> {
  sign(tx: UnsignedTransaction<C>[]): Promise<SignedTx[]>;
}

export function isSignOnlySigner(thing: any): thing is SignOnlySigner<Chain> {
  return (
    "chain" in thing &&
    typeof thing.chain === "function" &&
    "address" in thing &&
    typeof thing.address === "function" &&
    "sign" in thing &&
    typeof thing.sign === "function"
  );
}

// A SignAndSendSigner is for situations where the signer is
// connected to the network and wishes to broadcast the
// transactions themselves
export interface SignAndSendSigner<C extends Chain> extends SignerBase<C> {
  signAndSend(tx: UnsignedTransaction<C>[]): Promise<TxHash[]>;
}

export function isSignAndSendSigner(thing: any): thing is SignAndSendSigner<Chain> {
  return (
    "chain" in thing &&
    typeof thing.chain === "function" &&
    "address" in thing &&
    typeof thing.address === "function" &&
    "signAndSend" in thing &&
    typeof thing.signAndSend === "function"
  );
}
