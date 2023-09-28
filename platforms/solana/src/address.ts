import {
  isHexByteString,
  hexByteStringToUint8Array,
  Address,
  registerNative,
  UniversalAddress,
} from '@wormhole-foundation/connect-sdk';

import { PublicKey, PublicKeyInitData } from '@solana/web3.js';

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

  private readonly address: PublicKey;

  constructor(address: PublicKeyInitData | UniversalAddress) {
    if (address instanceof UniversalAddress)
      this.address = new PublicKey(address.toUint8Array());
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

  equals(other: UniversalAddress): boolean {
    return this.toUniversalAddress().equals(other);
  }
}

registerNative('Solana', SolanaAddress);
