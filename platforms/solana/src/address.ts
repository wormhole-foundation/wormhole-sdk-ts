import {
  isHexByteString,
  hexByteStringToUint8Array,
  Address,
  UniversalAddress,
  PlatformName,
} from '@wormhole-foundation/connect-sdk';

import { PublicKey } from '@solana/web3.js';
import { AnySolanaAddress } from './types';

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Solana: SolanaAddress;
    }
  }
}

// TODO: is there a zero address for Solana?
export const SolanaZeroAddress = '11111111111111111111111111111111';

export class SolanaAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform: PlatformName = 'Solana';

  private readonly address: PublicKey;

  constructor(address: AnySolanaAddress) {
    if (SolanaAddress.instanceof(address)) {
      const a = address as unknown as SolanaAddress;
      this.address = a.address;
      return;
    }
    if (UniversalAddress.instanceof(address))
      this.address = new PublicKey((address as UniversalAddress).toUint8Array());
    if (typeof address === 'string' && isHexByteString(address))
      this.address = new PublicKey(hexByteStringToUint8Array(address));
    else this.address = new PublicKey(address);
  }

  unwrap(): PublicKey {
    return this.address;
  }
  toString() {
    return this.address.toBase58();
  }
  toUint8Array() {
    return this.address.toBytes();
  }
  toNative() {
    return this;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.address.toBytes());
  }

  static instanceof(address: any) {
    return address.platform === SolanaAddress.platform;
  }

  equals(other: UniversalAddress): boolean {
    return this.toUniversalAddress().equals(other);
  }
}
