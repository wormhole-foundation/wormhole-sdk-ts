import {
  Address,
  UniversalAddress,
  PlatformName,
  registerNative,
  encoding,
  onlyOnce,
} from '@wormhole-foundation/connect-sdk';

import { PublicKey } from '@solana/web3.js';
import { AnySolanaAddress } from './types';
import { SolanaPlatform } from './platform';

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Solana: SolanaAddress;
    }
  }
}

export const SolanaZeroAddress = '11111111111111111111111111111111';

export class SolanaAddress implements Address {
  static readonly byteSize = 32;
  public readonly platform: PlatformName = SolanaPlatform.platform;

  private readonly address: PublicKey;

  constructor(address: AnySolanaAddress) {
    if (SolanaAddress.instanceof(address)) {
      const a = address as unknown as SolanaAddress;
      this.address = a.address;
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
    return this.address.toBytes();
  }
  toNative() {
    return this;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.address.toBytes());
  }

  static instanceof(address: any): address is SolanaAddress {
    return address.platform === SolanaPlatform.platform;
  }

  equals(other: SolanaAddress | UniversalAddress): boolean {
    if (SolanaAddress.instanceof(other)) {
      return other.unwrap().equals(this.unwrap());
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

onlyOnce(registerNative, 'Solana', SolanaAddress)();
