import {
  Address,
  Platform,
  UniversalAddress,
  encoding,
  registerNative,
} from '@wormhole-foundation/connect-sdk';

import { PublicKey } from '@solana/web3.js';
import { AnySolanaAddress, _platform } from './types';

export const SolanaZeroAddress = '11111111111111111111111111111111';

export class SolanaAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform: Platform = _platform;

  readonly type: string = 'Native';

  private readonly address: PublicKey;

  constructor(address: AnySolanaAddress) {
    if (SolanaAddress.instanceof(address)) {
      this.address = address.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = new PublicKey(address.toUint8Array());
    } else if (typeof address === 'string' && encoding.hex.valid(address)) {
      this.address = new PublicKey(encoding.hex.decode(address));
    } else {
      this.address = new PublicKey(address);
    }
  }

  unwrap(): PublicKey {
    return this.address;
  }
  toString() {
    return this.address.toBase58();
  }
  toUint8Array() {
    return new Uint8Array(this.address.toBytes());
  }
  toNative() {
    return this;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.toUint8Array());
  }

  static instanceof(address: any): address is SolanaAddress {
    return address.constructor.platform === SolanaAddress.platform;
  }

  equals(other: SolanaAddress | UniversalAddress): boolean {
    if (SolanaAddress.instanceof(other)) {
      return other.unwrap().equals(this.unwrap());
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

// This is required to make `type Z = NativeAddress<"Solana">;` resolve to SolanaAddress
// but outside this module it does _not_ resolve correctly
declare global {
  namespace WormholeNamespace {
    export interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Solana: SolanaAddress;
    }
  }
}

registerNative(_platform, SolanaAddress);
