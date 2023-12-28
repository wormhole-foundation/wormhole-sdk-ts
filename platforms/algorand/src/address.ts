import {
  Address,
  Platform,
  UniversalAddress,
  encoding,
  registerNative,
} from "@wormhole-foundation/connect-sdk";

import { AlgorandPlatform } from "./platform";
import { _platform, AnyAlgorandAddress } from "./types";
import { decodeAddress, encodeAddress, isValidAddress } from "algosdk";

export const AlgorandZeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

export class AlgorandAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform: Platform = _platform;

  readonly type: string = "Native";

  // stored as checksum address
  private readonly address: string;

  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      const a = address as unknown as AlgorandAddress;
      this.address = a.address;
      return;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = encodeAddress(address.toUint8Array());
    } else if (typeof address === "string" && isValidAddress(address)) {
      this.address = address;
    } else if (address instanceof Uint8Array && address.byteLength === AlgorandAddress.byteSize) {
      this.address = encodeAddress(address);
    } else if (address instanceof Uint8Array && address.byteLength === 8) {
      // ASA IDs are 8 bytes; this is padded to 32 bytes like addresses
      this.address = encodeAddress(encoding.bytes.zpad(address, AlgorandAddress.byteSize));
    } else if (typeof address === "bigint") {
      this.address = encodeAddress(encoding.bignum.toBytes(address, AlgorandAddress.byteSize));
    } else throw new Error(`Invalid Algorand address or ASA ID: ${address}`);
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
    return decodeAddress(this.address).publicKey;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.toUint8Array());
  }

  static instanceof(address: any): address is AlgorandAddress {
    return address.constructor.platform === AlgorandPlatform._platform;
  }

  equals(other: AlgorandAddress | UniversalAddress): boolean {
    if (AlgorandAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

declare global {
  namespace WormholeNamespace {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Algorand: AlgorandAddress;
    }
  }
}

registerNative(_platform, AlgorandAddress);
