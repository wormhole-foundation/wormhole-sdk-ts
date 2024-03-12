import { serializeLayout, deserializeLayout } from "@wormhole-foundation/sdk-base";
import { signatureItem } from "./layout-items";

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
