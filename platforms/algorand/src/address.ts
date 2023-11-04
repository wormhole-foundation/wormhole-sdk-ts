import {
  Address,
  UniversalAddress,
  registerNative,
  PlatformName,
} from '@wormhole-foundation/connect-sdk';
import { decodeAddress, encodeAddress, isValidAddress } from 'algosdk';
import { AlgorandPlatform } from './platform';
import { AnyAlgorandAddress } from './types';

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Algorand: AlgorandAddress;
    }
  }
}

export const AlgorandZeroAddress =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

// For padding 8-byte ASA IDs up to a longer length like addresses
function padBytesLeft(bytes: Uint8Array, length: number): Uint8Array {
  if (length < bytes.length) {
    throw new Error('Bytes length exceeds target length; cannot padBytesLeft');
  }
  const result = new Uint8Array(length);
  result.fill(0);
  // Pad left
  result.set(bytes, length - bytes.length);
  return result;
}

/* 
To align with other chains that use contract addresses for tokens, Algorand 
ASA ID uint64 values are padded to big-endian 32 bytes length like addresses
*/
export class AlgorandAddress implements Address {
  static readonly byteSize = 32;
  public readonly platform: PlatformName = AlgorandPlatform.platform;

  private readonly address: Uint8Array;

  // This may need to handle uint64s that represent a token ASA ID
  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      const a = address as AlgorandAddress;
      this.address = a.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = (address as UniversalAddress).toUint8Array();
    } else if (typeof address === 'string' && isValidAddress(address)) {
      this.address = decodeAddress(address).publicKey;
    } else if (
      address instanceof Uint8Array &&
      address.byteLength === AlgorandAddress.byteSize &&
      isValidAddress(encodeAddress(address))
    ) {
      this.address = address;
    } else if (address instanceof Uint8Array && address.byteLength === 8) {
      // Pad left the 8-byte value, presumably an ASA ID, up to 32 bytes
      const asaPaddedLeft = padBytesLeft(address, AlgorandAddress.byteSize);
      this.address = asaPaddedLeft;
    } else throw new Error(`Invalid Algorand address or ASA ID ${address}`);
  }

  unwrap(): AnyAlgorandAddress {
    return this.address;
  }
  toString() {
    return encodeAddress(this.address);
  }
  toUint8Array() {
    return this.address;
  }
  toNative() {
    return this;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.address);
  }

  static instanceof(address: any): address is AlgorandAddress {
    return address.platform === AlgorandPlatform.platform;
  }

  equals(other: AlgorandAddress | UniversalAddress): boolean {
    if (AlgorandAddress.instanceof(other)) {
      return other.unwrap() === this.unwrap();
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

try {
  registerNative('Algorand', AlgorandAddress);
} catch {}
