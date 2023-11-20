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

function isValidBigInt(value: string): boolean {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}

export class AlgorandAddress implements Address {
  // Public key in Algorand is a 32 byte array (users see 58 character string
  // of base32 encoding of the public key + checksum).
  //  source: https://developer.algorand.org/docs/get-details/encoding/#address
  static readonly byteSize = 32;
  public readonly platform = AlgorandPlatform.platform;

  // stored as checksum address
  private readonly address?: string;

  private readonly id?: string;

  constructor(address: AnyAlgorandAddress | bigint, isAssetId = false) {
    if (isAssetId) {
      this.id = address.toString();
      return;
    }

    if (AlgorandAddress.instanceof(address)) {
      const a = address as unknown as AlgorandAddress;
      this.address = a.address;
      return;
    }

    if (
      typeof address === 'bigint' ||
      (typeof address === 'string' && isValidBigInt(address))
    ) {
      if (address === 0n)
        throw new Error(
          `Invalid Algorand address; use "native" for the native token`,
        );
      this.address = address.toString();
    } else if (typeof address === 'string') {
      if (!AlgorandAddress.isValidAddress(address))
        throw new Error(
          `Invalid Algorand address, expected ${AlgorandAddress.byteSize}-byte (+2 checksum bytes), base32-encoded string of 58 characters but got ${address.length} characters`,
        );
      this.address = address;
    } else if (address instanceof Uint8Array) {
      if (address.length !== AlgorandAddress.byteSize)
        throw new Error(
          `Invalid Algorand address, expected ${AlgorandAddress.byteSize} bytes but got ${address.length} bytes`,
        );
      this.address = algosdk.encodeAddress(address);
    } else if (UniversalAddress.instanceof(address)) {
      this.address = algosdk.encodeAddress(address.toUint8Array());
    } else throw new Error(`Invalid Algorand address ${address}`);
  }

  unwrap(): string {
    return this.address ? this.address : this.id;
  }
  toString() {
    return this.address ? this.address : this.id;
  }
  toNative() {
    return this;
  }
  toUint8Array() {
    if (this.id) {
      return algosdk.bigIntToBytes(BigInt(this.id), 8);
    }
    return algosdk.decodeAddress(this.address).publicKey;
  }
  toUniversalAddress() {
    if (this.id) {
      // return new UniversalAddress(algosdk.bigIntToBytes(BigInt(this.id), 8));
      return new UniversalAddress(this.id, 'algorandAppId');
    }
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
