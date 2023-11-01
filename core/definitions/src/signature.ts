// Signature represents the secp256k1 signature of a Guardian

import { signatureItem } from "./layout-items";

// use layout-items/signature.ts to serialize/deserialize
export class Signature {
  constructor(
    readonly r: bigint,
    readonly s: bigint,
    readonly v: number,
  ) {}

  encode(): Uint8Array {
    return signatureItem.custom.from(this);
  }

  static decode(data: Uint8Array): Signature {
    return signatureItem.custom.to(data);
  }
}
