import type { Address} from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, registerNative } from "@wormhole-foundation/sdk-connect";
import type { AnyBtcAddress } from "./types.js";
import { _platform } from "./types.js";

/**
 * Minimal native Bitcoin address.
 *
 * Bitcoin addresses (P2PKH, P2SH, bech32, taproot) don't fit neatly into a
 * 32-byte universal representation, so we store the raw string and zero-pad
 * to 32 bytes for the UniversalAddress conversion.
 */
export class BtcAddress implements Address {
  static readonly byteSize = UniversalAddress.byteSize;
  static readonly platform = _platform;
  readonly type: string = "Native";

  readonly address: string;

  constructor(address: AnyBtcAddress) {
    if (BtcAddress.instanceof(address)) {
      this.address = (address as unknown as BtcAddress).address;
      return;
    }

    if (typeof address === "string") {
      this.address = address;
    } else if (address instanceof Uint8Array) {
      this.address = new TextDecoder().decode(address).replace(/\0+$/, "");
    } else {
      // UniversalAddress
      this.address = new TextDecoder()
        .decode(address.toUint8Array())
        .replace(/\0+$/, "");
    }
  }

  unwrap(): string {
    return this.address;
  }

  toString(): string {
    return this.address;
  }

  toNative(): this {
    return this;
  }

  toUint8Array(): Uint8Array {
    const encoded = new TextEncoder().encode(this.address);
    const padded = new Uint8Array(UniversalAddress.byteSize);
    padded.set(encoded.slice(0, UniversalAddress.byteSize));
    return padded;
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.toUint8Array());
  }

  static isValidAddress(address: string): boolean {
    return typeof address === "string" && address.length > 0;
  }

  static instanceof(address: any): address is BtcAddress {
    return address?.constructor?.platform === BtcAddress.platform;
  }

  equals(other: BtcAddress | UniversalAddress): boolean {
    if (BtcAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare module "@wormhole-foundation/sdk-connect" {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Btc: BtcAddress;
    }
  }
}

registerNative(_platform, BtcAddress);
