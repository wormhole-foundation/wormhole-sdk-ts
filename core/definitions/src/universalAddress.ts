import { encoding } from "@wormhole-foundation/sdk-base";

import { Address, NativeAddress, toNative } from "./address";

export class UniversalAddress implements Address {
  static readonly byteSize = 32;
  private readonly type = "Universal";

  private readonly address: Uint8Array;

  constructor(address: string | Uint8Array) {
    if (typeof address === "string") {
      if (!UniversalAddress.isValidAddress(address))
        throw new Error(
          `Invalid Wormhole address, expected ${UniversalAddress.byteSize}-byte ` +
          `hex string but got ${address}`,
        );

      this.address = encoding.hex.decode(address);
    } else {
      this.address = address;
    }
  }

  toNative<T extends Parameters<typeof toNative>[0]>(
    platform: T,
  ): NativeAddress<T> {
    return toNative(platform, this);
  }

  unwrap(): Uint8Array {
    return this.address;
  }
  toString() {
    return encoding.hex.encode(this.address, true);
  }
  toUint8Array() {
    return this.address;
  }
  toUniversalAddress() {
    return this;
  }

  equals(other: UniversalAddress): boolean {
    if (UniversalAddress.instanceof(other)) {
      return other.toString() === this.toString();
    }
    return false;
  }

  static isValidAddress(address: string) {
    return encoding.hex.valid(address) && encoding.stripPrefix("0x", address).length === UniversalAddress.byteSize * 2;
  }

  static instanceof(address: any) {
    return address.type === "Universal";
  }
}
