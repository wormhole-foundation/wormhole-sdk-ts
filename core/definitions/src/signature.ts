import { serializeLayout, deserializeLayout } from "@wormhole-foundation/sdk-base";
import { signatureItem } from "./layout-items/index.js";
import { secp256k1 } from "./utils.js";

/** Signature represents the secp256k1 signature of a Guardian */
export class Signature {
  constructor(
    readonly r: bigint,
    readonly s: bigint,
    readonly v: number,
  ) {}

  encode(): Uint8Array {
    return serializeLayout(signatureItem, this);
  }

  static decode(data: Uint8Array): Signature {
    return deserializeLayout(signatureItem, data);
  }
}

export namespace SignatureUtils {
  export function toPubkey(privateKey: string) {
    return secp256k1.getPublicKey(privateKey);
  }

  export function sign(privateKey: string, hash: Uint8Array) {
    if (hash.length != 32) throw new Error("hash.length != 32");
    return secp256k1.sign(hash, privateKey);
  }

  export function validate(signature: Signature, publicKey: Uint8Array, hash: Uint8Array) {
    const { r, s } = signature;
    return secp256k1.verify({ r, s }, hash, publicKey);
  }

  export function recover(signature: Signature, hash: Uint8Array): Uint8Array {
    const { r, s, v } = signature;
    const sig = new secp256k1.Signature(r, s);
    // @ts-ignore -- recovery field is marked readonly
    sig.recovery = v;
    const pubkey = sig.recoverPublicKey(hash);
    return pubkey.toRawBytes();
  }
}
