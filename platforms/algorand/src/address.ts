import { Address, UniversalAddress, registerNative } from "@wormhole-foundation/connect-sdk";

import { AlgorandPlatform } from "./platform";
import { _platform, AnyAlgorandAddress } from "./types";

export class AlgorandAddress implements Address {
  static readonly byteSize = 32;

  // stored as checksum address
  private readonly address: string;

  constructor(address: AnyAlgorandAddress) {
    //
    this.address = "";
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
    //return ethers.isAddress(address);
  }
  static instanceof(address: any): address is AlgorandAddress {
    return address.platform === AlgorandPlatform._platform;
  }
  equals(other: AlgorandAddress | UniversalAddress): boolean {
    if (AlgorandAddress.instanceof(other)) {
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
      Algorand: AlgorandAddress;
    }
  }
}

registerNative(_platform, AlgorandAddress);
