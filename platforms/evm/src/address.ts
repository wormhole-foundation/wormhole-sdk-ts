import type { Address } from '@wormhole-foundation/sdk-connect';
import {
  UniversalAddress,
  encoding,
  registerNative,
} from '@wormhole-foundation/sdk-connect';
import { getAddress, isAddress } from 'ethers';
import type { AnyEvmAddress } from './types.js';
import { _platform } from './types.js';

export const EvmZeroAddress = '0x0000000000000000000000000000000000000000';

export class EvmAddress implements Address {
  static readonly byteSize = 20;
  static readonly platform = _platform;
  readonly type: string = 'Native';

  // stored as checksum address
  readonly address: string;

  constructor(address: AnyEvmAddress) {
    if (EvmAddress.instanceof(address)) {
      const a = address as unknown as EvmAddress;
      this.address = a.address;
      return;
    }

    if (typeof address === 'string') {
      if (!EvmAddress.isValidAddress(address))
        throw new Error(
          `Invalid EVM address, expected ${EvmAddress.byteSize}-byte hex string but got ${address}`,
        );

      this.address = getAddress(address);
    } else if (address instanceof Uint8Array) {
      address = this.trimUniversalAddress(address);
      this.address = getAddress(encoding.hex.encode(address));
    } else if (UniversalAddress.instanceof(address)) {
      const addressBytes = this.trimUniversalAddress(address.toUint8Array());
      this.address = getAddress(encoding.hex.encode(addressBytes));
    } else throw new Error(`Invalid EVM address ${address}`);
  }

  unwrap(): string {
    return this.address;
  }
  toString() {
    return this.address;
  }
  toNative() {
    return this;
  }
  toUint8Array() {
    return encoding.hex.decode(this.address);
  }
  toUniversalAddress() {
    return new UniversalAddress(this.address, 'hex');
  }

  private trimUniversalAddress(address: Uint8Array): Uint8Array {
    if (address.length === EvmAddress.byteSize) return address;

    if (address.length < EvmAddress.byteSize)
      throw new Error(
        `Invalid evm address, expected ${EvmAddress.byteSize} bytes`,
      );

    if (address.length !== UniversalAddress.byteSize)
      throw new Error(
        `Invalid universal address, expected ${UniversalAddress.byteSize} bytes`,
      );

    // If the address is longer than 20 bytes, it is a universal address
    // that has been padded with 12 bytes of zeros
    if (encoding.bignum.decode(address.slice(0, 12)) !== 0n) {
      throw new Error(
        `Invalid EVM address ${address} expected first 12 bytes to be 0s`,
      );
    }

    return address.slice(12);
  }
  static isValidAddress(address: string) {
    return isAddress(address);
  }
  static instanceof(address: any): address is EvmAddress {
    return address.constructor.platform === EvmAddress.platform;
  }
  equals(other: EvmAddress | UniversalAddress): boolean {
    if (EvmAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare module '@wormhole-foundation/sdk-connect' {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Evm: EvmAddress;
    }
  }
}

registerNative(_platform, EvmAddress);
