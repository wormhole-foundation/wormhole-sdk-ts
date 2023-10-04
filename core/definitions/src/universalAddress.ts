import {
  hexByteStringToUint8Array,
  uint8ArrayToHexByteString,
  isHexByteString,
} from '@wormhole-foundation/sdk-base';

import { Address, NativeAddress, toNative } from './address';

export class UniversalAddress implements Address {
  static readonly byteSize = 32;

  private readonly address: Uint8Array;

  constructor(address: string | Uint8Array) {
    if (typeof address === 'string') {
      if (!UniversalAddress.isValidAddress(address))
        throw new Error(
          `Invalid Wormhole address, expected ${UniversalAddress.byteSize}-byte ` +
            `hex string but got ${address}`,
        );

      this.address = hexByteStringToUint8Array(address);
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
    return uint8ArrayToHexByteString(this.address);
  }
  toUint8Array() {
    return this.address;
  }
  toUniversalAddress() {
    return this;
  }

  equals(other: UniversalAddress): boolean {
    if (other instanceof UniversalAddress) {
      return other.toString() === this.toString();
    }
    return false;
  }

  static isValidAddress(address: string) {
    return isHexByteString(address, UniversalAddress.byteSize);
  }
}
