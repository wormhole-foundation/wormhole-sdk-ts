import { ChainName } from "@wormhole-foundation/sdk-base";
import { UnsignedTransaction } from "./unsignedTransaction";
import { SignedTx, TxHash } from "./types";

// A Signer is an interface that must be provided to certain methods
// in the SDK to sign transactions. It can be either a SignOnlySigner
// or a SignAndSendSigner depending on circumstances. 
// A Signer can be implemented by wrapping an existing offline wallet
// or a web wallet 
export type Signer = SignOnlySigner | SignAndSendSigner;

export function isSigner(thing: Signer | any): thing is Signer {
    return isSignOnlySigner(thing) || isSignAndSendSigner(thing)
}

// A SignOnlySender is for situations where the signer is not
// connected to the network or does not wish to broadcast the
// transactions themselves 
export interface SignOnlySigner {
    chain(): ChainName;
    address(): string;
    sign(tx: UnsignedTransaction[]): Promise<SignedTx[]>;
}
export function isSignOnlySigner(thing: SignOnlySigner | any): thing is SignOnlySigner {
    return (
        typeof (<SignOnlySigner>thing).chain === "function" &&
        typeof (<SignOnlySigner>thing).address == "function" &&
        typeof (<SignOnlySigner>thing).sign === "function"
    );
}

// A SignAndSendSigner is for situations where the signer is
// connected to the network and wishes to broadcast the
// transactions themselves 
export interface SignAndSendSigner {
    chain(): ChainName;
    address(): string;
    signAndSend(tx: UnsignedTransaction[]): Promise<TxHash[]>;
}

export function isSignAndSendSigner(thing: SignAndSendSigner | any): thing is SignAndSendSigner {
    return (
        typeof (<SignAndSendSigner>thing).chain === "function" &&
        typeof (<SignAndSendSigner>thing).address == "function" &&
        typeof (<SignAndSendSigner>thing).signAndSend === "function"
    );
}


