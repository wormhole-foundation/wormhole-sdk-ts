import { Address, UniversalAddress, registerNative } from "@wormhole-foundation/connect-sdk";

import { SuiPlatform } from "./platform";
import { _platform, AnySuiAddress } from "./types";
import { isValidSuiAddress } from "@mysten/sui.js";

export class SuiAddress implements Address {
  static readonly byteSize = 32;

  // stored as checksum address
  private readonly address: string;

  constructor(address: AnySuiAddress) {
    this.address = "TODO";
    //
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
    return new Uint8Array();
  }
  toUniversalAddress() {
    return new UniversalAddress(this.address);
  }

  static isValidAddress(address: string) {
    return isValidSuiAddress(address);
  }

  static instanceof(address: any): address is SuiAddress {
    return address.platform === SuiPlatform._platform;
  }
  equals(other: SuiAddress | UniversalAddress): boolean {
    if (SuiAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Sui: SuiAddress;
    }
  }
}

registerNative(_platform, SuiAddress);
