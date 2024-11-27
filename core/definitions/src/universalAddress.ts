import type { PlatformAddressFormat, Layout } from "@wormhole-foundation/sdk-base";
import { encoding, serializeLayout, throws } from "@wormhole-foundation/sdk-base";

import type { Address, NativeAddress } from "./address.js";
import { toNative } from "./address.js";
import { sha256, sha512_256 } from "./utils.js";

const algorandAppIdLayout = [
  { name: "appIdPrefix", binary: "bytes", custom: encoding.bytes.encode("appID"), omit: true },
  { name: "appId", binary: "uint", size: 8 },
] as const satisfies Layout;

/**
 * The UniversalAddress represents an address that has been parsed into its
 * byte representation and possibly modified to ensure it is exactly 32 bytes long
 */
export class UniversalAddress implements Address {
  static readonly byteSize = 32;
  static readonly type: string = "Universal";

  readonly address: Uint8Array;

  constructor(address: string | Uint8Array, format: PlatformAddressFormat = "hex") {
    this.address =
      typeof address === "string" ? UniversalAddress.stringToUint8Array(address, format) : address;
  }

  toNative<T extends Parameters<typeof toNative>[0]>(chainOrPlatform: T): NativeAddress<T> {
    return toNative(chainOrPlatform, this);
  }

  unwrap(): Uint8Array {
    return this.address;
  }
  toString() {
    return encoding.hex.encode(this.address, true);
  }
  toUint8Array() {
    return this.address;
  }
  toUniversalAddress() {
    return this;
  }

  equals(other: UniversalAddress): boolean {
    return encoding.bytes.equals(this.address, other.address);
  }

  static isValidAddress(address: string, format: PlatformAddressFormat = "hex") {
    return !throws(() => UniversalAddress.stringToUint8Array(address, format));
  }

  static instanceof(address: any): address is UniversalAddress {
    return (
      typeof address === "object" &&
      "constructor" in address &&
      address.constructor.type === UniversalAddress.type
    );
  }

  private static stringToUint8Array(address: string, format: PlatformAddressFormat): Uint8Array {
    const decoded = (() => {
      switch (format) {
        case "hex":
          if (
            ![40, 2 * this.byteSize].includes(address.length - (address.startsWith("0x") ? 2 : 0))
          )
            throw new Error(`string ${address} has invalid length for format ${format}`);
          return encoding.hex.decode(address);
        case "base58":
          return encoding.b58.decode(address);
        case "bech32":
          return encoding.bech32.decodeToBytes(address).bytes;
        case "algorandAppId":
          return sha512_256(serializeLayout(algorandAppIdLayout, { appId: BigInt(address) }));
        case "sha256":
          return sha256(address);
      }
    })();

    if (decoded.length > UniversalAddress.byteSize)
      throw new Error(`string ${address} has invalid length for format ${format}`);

    return decoded.length < UniversalAddress.byteSize
      ? encoding.bytes.zpad(decoded, UniversalAddress.byteSize)
      : decoded;
  }
}
