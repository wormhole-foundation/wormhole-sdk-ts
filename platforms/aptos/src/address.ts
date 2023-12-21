import {
  Address,
  Platform,
  UniversalAddress,
  encoding,
  registerNative,
} from "@wormhole-foundation/connect-sdk";

import { APTOS_SEPARATOR } from "./constants";
import { AptosPlatform } from "./platform";
import { AnyAptosAddress, isValidAptosType } from "./types";

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
  public readonly platform: Platform = AptosPlatform._platform;

  // Full 32 bytes of Address
  private readonly address: Uint8Array;
  // Optional module and contract name
  private readonly module: string | undefined;

  constructor(address: AnyAptosAddress) {
    if (AptosAddress.instanceof(address)) {
      this.address = address.address;
      this.module = address.module;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (typeof address === "string") {
      // If we've got an address of the form `0x1234...::module::...` then
      // stuff anything after the first `::` into the module field
      // and continue processing the address
      if (isValidAptosType(address)) {
        const chunks = address.split(APTOS_SEPARATOR);
        this.module = chunks.slice(1).join(APTOS_SEPARATOR);
        address = chunks[0];
      }

      address = ensureFullAptosAddress(address);
      if (!encoding.hex.valid(address)) throw new Error("Invalid Aptos address: " + address);

      this.address = encoding.hex.decode(address);
    } else {
      this.address = address as Uint8Array;
    }
  }

  unwrap(): string {
    const addr = encoding.hex.encode(this.address).replace(/^0+/, "");
    const module = this.module ? APTOS_SEPARATOR + this.module : "";
    return `0x${addr}${module}`;
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
    return address.platform === AptosPlatform._platform;
  }

  equals(other: AptosAddress | UniversalAddress): boolean {
    if (AptosAddress.instanceof(other)) {
      return other.unwrap() === this.unwrap();
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

declare global {
  namespace WormholeNamespace {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Aptos: AptosAddress;
    }
  }
}

registerNative("Aptos", AptosAddress);
