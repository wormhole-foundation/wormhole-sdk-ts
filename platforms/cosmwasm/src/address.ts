import { toBech32, fromHex, fromBech32, toHex } from "@cosmjs/encoding";
import { Address, UniversalAddress } from "@wormhole-foundation/connect-sdk";

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      // @ts-ignore
      Cosmwasm: CosmwasmAddress;
    }
  }
}

export class CosmwasmAddress implements Address {
  static readonly byteSize = 32;

  private readonly prefix: string;
  private readonly address: Uint8Array;

  constructor(address: string | Uint8Array | UniversalAddress) {
    if (typeof address === "string") {
      if (!CosmwasmAddress.isValidAddress(address))
        throw new Error(`Invalid Cosmwasm address:  ${address}`);

      const { data, prefix } = fromBech32(address);
      this.address = data;
      this.prefix = prefix;
    } else if (address instanceof Uint8Array) {
      if (address.length !== CosmwasmAddress.byteSize)
        throw new Error(
          `Invalid Cosmwasm address, expected ${CosmwasmAddress.byteSize} bytes but got ${address.length}`
        );

      this.prefix = "";
      this.address = address;
    } else if (address instanceof UniversalAddress) {
      // If its a universal address and we want it to be an ethereum address,
      // we need to chop off the first 12 bytes of padding
      const addressBytes = address.toUint8Array();
      // double check to make sure there are no non zero bytes
      if (addressBytes.length != CosmwasmAddress.byteSize)
        throw new Error(`Invalid Cosmwasm address ${address}`);

      this.address = addressBytes;
      this.prefix = "";
    } else throw new Error(`Invalid Cosmwasm address ${address}`);
  }

  unwrap(): string {
    return this.toString();
  }

  toString() {
    return toBech32(this.prefix, this.address);
  }

  toNative() {
    return this;
  }

  toUint8Array() {
    return this.address;
  }

  toUniversalAddress() {
    const buff = new Uint8Array(UniversalAddress.byteSize);
    buff.set(this.address, UniversalAddress.byteSize - this.address.length);
    return new UniversalAddress(buff);
  }

  static isValidAddress(address: string): boolean {
    try {
      const maybe = fromBech32(address);
      return (
        maybe.data.length === CosmwasmAddress.byteSize && maybe.prefix !== ""
      );
    } catch (e) {}
    return false;
  }

  equals(other: UniversalAddress): boolean {
    return other.equals(this.toUniversalAddress());
  }
}
