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
      if (address.length !== EvmAddress.byteSize)
        throw new Error(
          `Invalid EVM address, expected ${EvmAddress.byteSize} bytes but got ${address.length}`,
        );

      this.address = getAddress(encoding.hex.encode(address));
    } else if (UniversalAddress.instanceof(address)) {
      // If its a universal address and we want it to be an ethereum address,
      // we need to chop off the first 12 bytes of padding
      const addressBytes = address.toUint8Array();
      // double check to make sure there are no non zero bytes
      if (
        addressBytes.slice(0, 12).some((v) => {
          v !== 0;
        })
      )
        throw new Error(`Invalid EVM address ${address}`);

      const suffix = encoding.hex.encode(addressBytes.slice(12));
      this.address = getAddress(suffix);
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
