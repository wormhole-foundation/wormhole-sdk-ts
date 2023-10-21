// Signature represents the secp256k1 signature of a Guardian
// use layout-items/signature.ts to serialize/deserialize
export class Signature {
  constructor(
    readonly r: bigint,
    readonly s: bigint,
    readonly v: number,
  ) { }
}
