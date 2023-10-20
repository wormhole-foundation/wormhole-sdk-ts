// Signature represents the secp256k1 signature of a Guardian
export class Signature {
  constructor(
    readonly r: bigint,
    readonly s: bigint,
    readonly v: number,
  ) { }

  toUint8Array(): Uint8Array {
    const buff = new Uint8Array(65);
    buff.set(Buffer.from(this.r.toString(16).padStart(64, "0"), "hex"));
    buff.set(Buffer.from(this.s.toString(16).padStart(64, "0"), "hex"), 32);
    buff.set([this.v], 64);
    return buff;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.toUint8Array());
  }
}
