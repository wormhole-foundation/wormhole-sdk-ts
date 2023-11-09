import {
  Address,
  PlatformName,
  UniversalAddress,
  encoding,
  registerNative,
} from "@wormhole-foundation/connect-sdk";

import { APTOS_SEPARATOR } from "./constants";
import { AptosPlatform } from "./platform";
import { AnyAptosAddress, isValidAptosType } from "./types";

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Aptos: AptosAddress;
    }
  }
}


export const AptosZeroAddress = "0x";

export class AptosAddress implements Address {
  static readonly byteSize = 32;
  public readonly platform: PlatformName = AptosPlatform.platform;

  private readonly address: Uint8Array;

  constructor(address: AnyAptosAddress) {
    if (AptosAddress.instanceof(address)) {
      const a = address as unknown as AptosAddress;
      this.address = a.address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (typeof address === "string" && encoding.hex.valid(address)) {
      // A resource or object 
      if (isValidAptosType(address)) {
        const chunks = address.split(APTOS_SEPARATOR)
        this.address = encoding.hex.decode(chunks[0])
      } else {
        this.address = encoding.hex.decode(address);
      }
    } else {
      this.address = address as Uint8Array;
    }
  }

  unwrap(): string {
    return encoding.hex.encode(this.address, true);
  }
  toString(): string {
    return this.unwrap();
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

  static instanceof(address: any): address is AptosAddress {
    return address.platform === AptosPlatform.platform;
  }

  equals(other: AptosAddress | UniversalAddress): boolean {
    if (AptosAddress.instanceof(other)) {
      return other.unwrap() === this.unwrap();
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

try {
  registerNative("Aptos", AptosAddress);
} catch { }
