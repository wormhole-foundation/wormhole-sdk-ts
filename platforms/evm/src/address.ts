import {
  Address,
  UniversalAddress,
  encoding,
  registerNative,
} from '@wormhole-foundation/connect-sdk';

import { ethers } from 'ethers';
import { AnyEvmAddress, _platform } from './types';

export const EvmZeroAddress = ethers.ZeroAddress;

export class EvmAddress implements Address {
  static readonly byteSize = 20;
  static readonly platform = _platform;
  readonly type: string = 'Native';

  // stored as checksum address
  private readonly address: string;

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

      this.address = ethers.getAddress(address);
    } else if (address instanceof Uint8Array) {
      if (address.length !== EvmAddress.byteSize)
        throw new Error(
          `Invalid EVM address, expected ${EvmAddress.byteSize} bytes but got ${address.length}`,
        );

      this.address = ethers.getAddress(ethers.hexlify(address));
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
      this.address = ethers.getAddress(suffix);
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
    return ethers.getBytes(this.address);
  }
  toUniversalAddress() {
    return new UniversalAddress(
      ethers.zeroPadValue(this.address, UniversalAddress.byteSize),
    );
  }
  static isValidAddress(address: string) {
    return ethers.isAddress(address);
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

declare global {
  namespace WormholeNamespace {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Evm: EvmAddress;
    }
  }
}

registerNative(_platform, EvmAddress);
