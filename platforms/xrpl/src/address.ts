import {
  type Address,
  UniversalAddress,
  encoding,
  registerNative,
} from "@wormhole-foundation/sdk-connect";
import { isValidClassicAddress, decodeAccountID } from "xrpl";
import { _platform, type AnyXrplAddress } from "./types.js";

/** XRPL ACCOUNT_ZERO — the "black hole" account  https://xrpl.org/docs/concepts/accounts/addresses#special-addresses */
export const XrplZeroAddress = "rrrrrrrrrrrrrrrrrrrrrhoLvTp";

/** Discriminator for XRPL address / token-identifier forms */
type XrplAddressFormat = "account" | "iou" | "mpt";

// IOU token code validation (matches ripple-binary-codec conventions):
// Standard 3-char code, the part before the dot in "FOO.rIssuer..."
const IOU_STANDARD_CODE_REGEX = /^[A-Z0-9a-z?!@#$%^&*(){}[\]|]{3}$/;
// Non-standard 40-char hex code (20 bytes), the part before the dot in "<hex>.rIssuer..."
const IOU_HEX_CODE_REGEX = /^[A-Fa-f0-9]{40}$/;
// Full MPT issuance ID: 48-char hex (24-byte Hash192)
const MPT_ADDRESS_REGEX = /^[0-9a-fA-F]{48}$/;

// Encode a standard 3-char IOU code into 20 bytes using the XRPL canonical format:
// bytes 0-11 = 0x00, bytes 12-14 = ASCII, bytes 15-19 = 0x00.
// https://xrpl.org/docs/references/protocol/data-types/currency-formats
function isoToBytes(iso: string): Uint8Array {
  const bytes = new Uint8Array(20);
  for (let i = 0; i < iso.length; i++) {
    bytes[12 + i] = iso.charCodeAt(i);
  }
  return bytes;
}

export class XrplAddress implements Address {
  static readonly byteSize = 20;
  static readonly platform = _platform;
  readonly type: string = "Native";

  readonly address: string;
  /** @internal token-identifier format */
  readonly _format: XrplAddressFormat;

  constructor(address: AnyXrplAddress) {
    // Check if the input is already an XrplAddress instance
    if (XrplAddress.instanceof(address)) {
      const xrplAddress = address as XrplAddress;
      this.address = xrplAddress.address;
      this._format = xrplAddress._format;
    } else if (typeof address === "string") {
      if (XrplAddress.isIouTokenId(address)) {
        // IOU format: CODE.rIssuerAddress (e.g. "FOO.rBa2jdUu8S2ZzaCJv8y1Lx9Pdrns51hJj")
        this.address = address;
        this._format = "iou";
      } else if (XrplAddress.isMptTokenId(address)) {
        // MPT format: 48-char hex issuance ID (24-byte Hash192)
        this.address = address;
        this._format = "mpt";
      } else if (isValidClassicAddress(address)) {
        // Standard r-address
        this.address = address;
        this._format = "account";
      } else {
        throw new Error(`Invalid XRPL address or token identifier: ${address}`);
      }
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
    switch (this._format) {
      case "account":
        return decodeAccountID(this.address);
      case "mpt":
        // 24-byte MPT Issuance ID
        return encoding.hex.decode(this.address);
      case "iou": {
        // Token code (20 bytes canonical) + issuer account ID (20 bytes)
        const { code, issuer } = XrplAddress.parseIou(this.address);
        const codeBytes = IOU_STANDARD_CODE_REGEX.test(code)
          ? isoToBytes(code)
          : encoding.hex.decode(code);
        const issuerBytes = decodeAccountID(issuer);
        const result = new Uint8Array(40);
        result.set(codeBytes, 0);
        result.set(issuerBytes, 20);
        return result;
      }
    }
  }

  // UniversalAddress is a 32-byte canonical representation used by Wormhole contracts
  // to identify addresses/tokens across chains. Each format is converted as follows:
  //   - account: 20-byte account ID (from decodeAccountID) left-zero-padded to 32 bytes
  //   - mpt: 24-byte issuance ID (hex decoded) left-zero-padded to 32 bytes
  //   - iou: 40 bytes of data (20 code + 20 issuer) exceeds 32 bytes, so we SHA-256
  //     hash the full identifier string (same approach as the Stacks platform)
  toUniversalAddress(): UniversalAddress {
    switch (this._format) {
      case "account": {
        const accountId = decodeAccountID(this.address);
        const padded = new Uint8Array(UniversalAddress.byteSize);
        padded.set(accountId, UniversalAddress.byteSize - accountId.length);
        return new UniversalAddress(padded);
      }
      case "mpt": {
        const bytes = encoding.hex.decode(this.address);
        const padded = new Uint8Array(UniversalAddress.byteSize);
        padded.set(bytes, UniversalAddress.byteSize - bytes.length);
        return new UniversalAddress(padded);
      }
      case "iou":
        return new UniversalAddress(this.address, "sha256");
    }
  }

  static isValidAddress(address: string): boolean {
    return (
      isValidClassicAddress(address) ||
      XrplAddress.isIouTokenId(address) ||
      XrplAddress.isMptTokenId(address)
    );
  }

  /** IOU format: CODE.rIssuerAddress */
  private static isIouTokenId(address: string): boolean {
    const dotIndex = address.indexOf(".");
    if (dotIndex <= 0) {
      return false;
    }

    const code = address.substring(0, dotIndex);
    const issuer = address.substring(dotIndex + 1);
    const isValidCode = IOU_STANDARD_CODE_REGEX.test(code) || IOU_HEX_CODE_REGEX.test(code);
    return isValidCode && isValidClassicAddress(issuer);
  }

  /** MPT format: 48-char hex issuance ID (192-bit Hash192) */
  private static isMptTokenId(address: string): boolean {
    return MPT_ADDRESS_REGEX.test(address) && address.length === 48;
  }

  /** Split an IOU string into code and issuer */
  private static parseIou(address: string): { code: string; issuer: string } {
    const dotIndex = address.indexOf(".");
    return {
      code: address.substring(0, dotIndex),
      issuer: address.substring(dotIndex + 1),
    };
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
