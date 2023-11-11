import {
  Address,
  UniversalAddress,
  registerNative,
  PlatformName,
} from '@wormhole-foundation/connect-sdk';
import {
  bigIntToBytes,
  bytesToBigInt,
  decodeAddress,
  decodeUint64,
  encodeAddress,
  isValidAddress,
} from 'algosdk';
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

/* 
To align with other chains that use contract addresses for tokens, Algorand 
ASA ID uint64 values are padded to big-endian 32 bytes length like addresses
*/
export class AlgorandAddress implements Address {
  static readonly byteSize = 32;
  public readonly platform: PlatformName = AlgorandPlatform.platform;

  private readonly address: Uint8Array;

  /*
export type AnyAddress =
  | NativeAddress<PlatformName> - ???
  | UniversalAddress - done
  | string - done
  | number - done
  | Uint8Array - done
  | number[]; - ???
*/

  // This may need to handle uint64s that represent a token ASA ID
  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      const a = address as AlgorandAddress;
      this.address = a.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (typeof address === 'string' && isValidAddress(address)) {
      this.address = decodeAddress(address).publicKey;
    } else if (typeof address === 'number') {
      this.address = bigIntToBytes(BigInt(address), 32);
    } else if (typeof address === 'bigint') {
      this.address = bigIntToBytes(address, 32);
    } else if (
      address instanceof Uint8Array &&
      address.byteLength === AlgorandAddress.byteSize &&
      isValidAddress(encodeAddress(address))
    ) {
      this.address = address;
    } else if (address instanceof Uint8Array && address.byteLength === 8) {
      this.address = bigIntToBytes(bytesToBigInt(address), 32);
    } else throw new Error(`Invalid Algorand address or ASA ID ${address}`);
  }

  unwrap(): AnyAlgorandAddress {
    return this.address;
  }

  toString(): string {
    return encodeAddress(this.address);
  }

  toUint8Array(): Uint8Array {
    return this.address;
  }

  toNative() {
    return this;
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.address);
  }

  // QUESTION: Does this need a warning if an actual address, not a Uint64, is in the class?
  toBigInt(): bigint {
    const lastEightBytes = this.address.slice(-8);
    return decodeUint64(lastEightBytes, 'bigint');
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
