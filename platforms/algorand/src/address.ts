import {
  Address,
  Platform,
  UniversalAddress,
  encoding,
  registerNative,
} from "@wormhole-foundation/connect-sdk";

import { AlgorandPlatform } from "./platform";
import { _platform, AnyAlgorandAddress, safeBigIntToNumber } from "./types";
import { decodeAddress, encodeAddress, isValidAddress } from "algosdk";

export const AlgorandZeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

// Note: for ASA/App IDs we encode them as 8 bytes at the start of
// the 32 byte adddress bytes.

export class AlgorandAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform: Platform = _platform;

  readonly type: string = "Native";

  private readonly address: Uint8Array;

  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      this.address = address.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (address instanceof Uint8Array && address.byteLength === AlgorandAddress.byteSize) {
      this.address = address;
    } else if (typeof address === "string" && isValidAddress(address)) {
      this.address = decodeAddress(address).publicKey;
    } else if (typeof address === "string" && !isNaN(parseInt(address))) {
      this.address = encoding.bytes.zpad(
        encoding.bignum.toBytes(BigInt(address), 8),
        AlgorandAddress.byteSize,
      );
    } else if (typeof address === "bigint") {
      this.address = encoding.bytes.zpad(
        encoding.bignum.toBytes(address, 8),
        AlgorandAddress.byteSize,
      );
    } else if (address instanceof Uint8Array && address.byteLength === 8) {
      this.address = encoding.bytes.zpad(address, AlgorandAddress.byteSize);
    } else throw new Error(`Invalid Algorand address or ASA ID: ${address}`);
  }

  unwrap(): string {
    return this.toString();
  }
  toString() {
    return encodeAddress(this.address);
  }
  toNative() {
    return this;
  }
  toUint8Array() {
    return this.address;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.toUint8Array());
  }

  toBigInt(): bigint {
    return encoding.bignum.decode(this.toUint8Array().slice(24, 32));
  }

  toInt(): number {
    return safeBigIntToNumber(this.toBigInt());
  }

  equals(other: AlgorandAddress | UniversalAddress): boolean {
    if (AlgorandAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
  static instanceof(address: any): address is AlgorandAddress {
    return address.constructor.platform === AlgorandPlatform._platform;
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
