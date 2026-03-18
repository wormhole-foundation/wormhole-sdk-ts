import { Address, UniversalAddress, registerNative } from "@wormhole-foundation/sdk-connect";
import { _platform, AnyXrplAddress } from "./types.js";
import { isValidClassicAddress, decodeAccountID } from "xrpl";

/** XRPL ACCOUNT_ZERO — the "black hole" account  https://xrpl.org/docs/concepts/accounts/addresses#special-addresses */
export const XrplZeroAddress = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";

export class XrplAddress implements Address {
  static readonly byteSize = 20;
  static readonly platform = _platform;
  readonly type: string = "Native";

  readonly address: string;

  constructor(address: AnyXrplAddress) {
    if (XrplAddress.instanceof(address)) {
      const a = address as unknown as XrplAddress;
      this.address = a.address;
      return;
    }

    if (typeof address === "string") {
      if (!XrplAddress.isValidAddress(address)) {
        throw new Error(`Invalid XRPL address: ${address}`);
      }
      this.address = address;
    } else {
      throw new Error(`Invalid XRPL address: ${address}`);
    }
  }

  unwrap(): string {
    return this.address;
  }

  toString(): string {
    return this.address;
  }

  toNative() {
    return this;
  }

  toUint8Array(): Uint8Array {
    return decodeAccountID(this.address);
  }

  toUniversalAddress(): UniversalAddress {
    const accountId = decodeAccountID(this.address);
    const padded = new Uint8Array(UniversalAddress.byteSize);
    padded.set(accountId, UniversalAddress.byteSize - accountId.length);
    return new UniversalAddress(padded);
  }

  static isValidAddress(address: string): boolean {
    return isValidClassicAddress(address);
  }

  static instanceof(address: any): address is XrplAddress {
    return address.constructor.platform === XrplAddress.platform;
  }

  equals(other: XrplAddress | UniversalAddress): boolean {
    if (XrplAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare module "@wormhole-foundation/sdk-connect" {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Xrpl: XrplAddress;
    }
  }
}

registerNative(_platform, XrplAddress);
