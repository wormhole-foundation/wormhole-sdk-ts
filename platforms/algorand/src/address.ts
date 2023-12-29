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

  private readonly address: Uint8Array;

  constructor(address: AnyAlgorandAddress) {
    if (AlgorandAddress.instanceof(address)) {
      this.address = address.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (typeof address === "string" && isValidAddress(address)) {
      this.address = decodeAddress(address).publicKey;
    } else if (typeof address === "string" && !isNaN(parseInt(address))) {
      this.address = encoding.bignum.toBytes(BigInt(address), AlgorandAddress.byteSize);
    } else if (address instanceof Uint8Array && address.byteLength === AlgorandAddress.byteSize) {
      this.address = address;
    } else if (address instanceof Uint8Array && address.byteLength === 8) {
      this.address = encoding.bytes.zpad(address, AlgorandAddress.byteSize);
    } else if (typeof address === "bigint") {
      this.address = encoding.bignum.toBytes(address, AlgorandAddress.byteSize);
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
  toInt(): bigint {
    return encoding.bignum.decode(this.toUint8Array());
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
