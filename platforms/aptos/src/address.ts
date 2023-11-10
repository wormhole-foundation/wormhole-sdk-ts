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

// Sometimes Aptos addresses will be trimmed of leading 0s
// add them back if necessary
export function ensureFullAptosAddress(address: string) {
  if (address.length % 2 !== 0 || address.length < 66) {
    address = address.startsWith("0x") ? address.slice(2) : address;
    return "0x" + address.padStart(64, "0");
  }
  return address;
}

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
    } else if (typeof address === "string") {
      if (isValidAptosType(address)) {
        const chunks = address.split(APTOS_SEPARATOR);
        address = chunks[0];
      }
      address = ensureFullAptosAddress(address);

      if (!encoding.hex.valid(address)) throw new Error("Invalid Aptos address: " + address);

      this.address = encoding.hex.decode(address);
    } else {
      this.address = address;
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
} catch {}
