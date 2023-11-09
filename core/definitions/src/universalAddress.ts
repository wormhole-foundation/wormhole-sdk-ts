import { encoding, PlatformAddressFormat, Layout, serializeLayout, throws } from "@wormhole-foundation/sdk-base";

import { Address, NativeAddress, toNative } from "./address";
import { sha512_256 } from "./utils";

const algorandAppIdLayout = [
  { name: "appIdPrefix", binary: "bytes", custom: encoding.toUint8Array("appID"), omit: true },
  { name: "appId", binary: "uint", size: 8 },
] as const satisfies Layout;

export class UniversalAddress implements Address {
  static readonly byteSize = 32;
  readonly type: string = "Universal";

  private readonly address: Uint8Array;

  constructor(address: string | Uint8Array, format: PlatformAddressFormat = "hex") {
    this.address = typeof address === "string"
      ? UniversalAddress.stringToUint8Array(address, format)
      : address;
  }

  toNative<T extends Parameters<typeof toNative>[0]>(platform: T): NativeAddress<T> {
    return toNative(platform, this);
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
    return encoding.equals(this.address, other.address);
  }

  static isValidAddress(address: string, format: PlatformAddressFormat = "hex") {
    return !throws(() => UniversalAddress.stringToUint8Array(address, format));
  }

  //TODO isn't this quite the code smell? - why would we have to test an any?
  static instanceof(address: any): address is UniversalAddress {
    return typeof address === "object" && "type" in address && address.type === "Universal";
  }

  private static stringToUint8Array(address: string, format: PlatformAddressFormat): Uint8Array {
    const decoded = (() => {
    switch (format) {
      case "hex":
        if (![40, 2*this.byteSize].includes(address.length - (address.startsWith("0x") ? 2 : 0)))
          throw new Error(`string ${address} has invalid length for format ${format}`);
        return encoding.hex.decode(address);
      case "base58":
        return encoding.b58.decode(address);
      case "bech32":
        return encoding.bech32.decodeToBytes(address).bytes;
      case "algorandAppId":
        return sha512_256(serializeLayout(algorandAppIdLayout, { appId: BigInt(address) }));
      }
    })();

    if (decoded.length > UniversalAddress.byteSize)
      throw new Error(`string ${address} has invalid length for format ${format}`);

    return decoded.length < UniversalAddress.byteSize
      ? encoding.concat(new Uint8Array(UniversalAddress.byteSize - decoded.length), decoded)
      : decoded;
  }
}
