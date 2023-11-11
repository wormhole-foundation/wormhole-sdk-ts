import {
  Address,
  UniversalAddress,
  registerNative,
} from '@wormhole-foundation/connect-sdk';

import algosdk from 'algosdk';
import { AnyAlgorandAddress } from './types';
import { AlgorandPlatform } from './platform';

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Algorand: AlgorandAddress;
    }
  }
}

export const AlgorandZeroAddress = algosdk.getApplicationAddress(0);

export class AlgorandAddress implements Address {
  // Public key in Algorand is a 32 byte array (users see 58 character string
  // of base32 encoding of the public key + checksum).
  //  source: https://developer.algorand.org/docs/get-details/encoding/#address
  static readonly byteSize = 32;
  public readonly platform = AlgorandPlatform.platform;

  // stored as checksum address
  private readonly address: string;

  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      const a = address as unknown as AlgorandAddress;
      this.address = a.address;
      return;
    }
    if (typeof address === 'string') {
      if (!AlgorandAddress.isValidAddress(address))
        throw new Error(
          `Invalid Algorand address, expected ${AlgorandAddress.byteSize}-byte (+2 checksum bytes), base32-encoded string of 58 characters but got ${address}`,
        );
      this.address = address;
    } else if (address instanceof Uint8Array) {
      if (address.length !== AlgorandAddress.byteSize)
        throw new Error(
          `Invalid Algorand address, expected ${AlgorandAddress.byteSize} bytes but got ${address.length}`,
        );
      this.address = algosdk.encodeAddress(address);
    } else if (UniversalAddress.instanceof(address)) {
      this.address = algosdk.encodeAddress(address.toUint8Array());
    } else throw new Error(`Invalid Algorand address ${address}`);
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
    return algosdk.decodeAddress(this.address).publicKey;
  }
  toUniversalAddress() {
    return new UniversalAddress(algosdk.decodeAddress(this.address).publicKey);
  }
  static isValidAddress(address: string) {
    return algosdk.isValidAddress(address);
  }
  static instanceof(address: any): address is AlgorandAddress {
    return address.platform === AlgorandPlatform.platform;
  }
  equals(other: AlgorandAddress | UniversalAddress): boolean {
    if (AlgorandAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

try {
  registerNative('Algorand', AlgorandAddress);
} catch {}
