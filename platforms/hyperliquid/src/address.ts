import type { Address } from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, registerNative, encoding } from "@wormhole-foundation/sdk-connect";

import { HYPERLIQUID_ZERO_ADDRESS } from "./constants.js";
import type { AnyHyperliquidAddress } from "./types.js";
import { _platform } from "./types.js";

export class HyperliquidAddress implements Address {
  static readonly byteSize = 20;
  static readonly platform = _platform;

  readonly type: string = "Native";
  readonly address: Uint8Array;

  constructor(address: AnyHyperliquidAddress) {
    if (HyperliquidAddress.instanceof(address)) {
      this.address = address.address;
    } else if (UniversalAddress.instanceof(address)) {
      // Take the last 20 bytes from UniversalAddress
      const full = address.toUint8Array();
      this.address = full.slice(-20);
    } else if (typeof address === "string") {
      // Ensure proper formatting
      address = address.toLowerCase();
      if (!address.startsWith("0x")) {
        address = "0x" + address;
      }

      // Pad or trim to 20 bytes (40 hex chars + 0x prefix)
      if (address.length < 42) {
        address = "0x" + address.slice(2).padStart(40, "0");
      } else if (address.length > 42) {
        address = "0x" + address.slice(-40);
      }

      if (!encoding.hex.valid(address)) {
        throw new Error("Invalid Hyperliquid address: " + address);
      }

      this.address = encoding.hex.decode(address);
    } else {
      this.address = address as Uint8Array;
    }
  }

  unwrap(): string {
    return "0x" + encoding.hex.encode(this.address);
  }

  toString(): string {
    return this.unwrap();
  }

  toNative() {
    // Since Hyperliquid only deals with USDC and has no native gas token,
    // we return a USDC address representation
    return new HyperliquidAddress(HYPERLIQUID_ZERO_ADDRESS);
  }

  toUint8Array() {
    return this.address;
  }

  toUniversalAddress() {
    // Pad to 32 bytes for UniversalAddress
    const padded = new Uint8Array(32);
    padded.set(this.address, 12);
    return new UniversalAddress(padded);
  }

  static instanceof(address: any): address is HyperliquidAddress {
    return address?.constructor?.platform === HyperliquidAddress.platform;
  }

  equals(other: HyperliquidAddress | UniversalAddress): boolean {
    if (HyperliquidAddress.instanceof(other)) {
      return other.unwrap().toLowerCase() === this.unwrap().toLowerCase();
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

declare module "@wormhole-foundation/sdk-connect" {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Hyperliquid: HyperliquidAddress;
    }
  }
}

registerNative(_platform, HyperliquidAddress);
