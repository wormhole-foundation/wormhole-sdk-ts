import type { Address} from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, registerNative } from "@wormhole-foundation/sdk-connect";
import type { AnyBtcAddress } from "./types.js";
import { _platform } from "./types.js";
import { isValidBtcAddress } from "./validation.js";

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

    let decoded: string;
    if (typeof address === "string") {
      decoded = address.trim();
    } else if (address instanceof Uint8Array) {
      decoded = new TextDecoder().decode(address).replace(/\0+$/, "").trim();
    } else {
      // UniversalAddress
      decoded = new TextDecoder()
        .decode(address.toUint8Array())
        .replace(/\0+$/, "")
        .trim();
    }

    if (!BtcAddress.isValidAddress(decoded)) {
      throw new Error(`Invalid BTC address: ${JSON.stringify(decoded)}`);
    }

    this.address = decoded;
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
    if (encoded.length > UniversalAddress.byteSize) {
      throw new RangeError(
        `BTC address encoding exceeds UniversalAddress size: encoded length ${encoded.length} > ${UniversalAddress.byteSize} bytes`,
      );
    }
    const padded = new Uint8Array(UniversalAddress.byteSize);
    padded.set(encoded);
    return padded;
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.toUint8Array());
  }

  static isValidAddress(address: string): boolean {
    return isValidBtcAddress(address);
  }

  static instanceof(address: any): address is BtcAddress {
    return address?.constructor?.platform === BtcAddress.platform;
  }

  equals(other: BtcAddress | UniversalAddress): boolean {
    if (BtcAddress.instanceof(other)) {
      return other.address === this.address;
    }
    try {
      return other.equals(this.toUniversalAddress());
    } catch (e) {
      if (e instanceof RangeError) return false;
      throw e;
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
