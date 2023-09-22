import { toBech32, fromBech32, fromHex } from "@cosmjs/encoding";
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
  static readonly contractAddressByteSize = 32;
  static readonly accountAddressByteSize = 20;

  private readonly prefix: string;
  private readonly address: Uint8Array;

  constructor(address: string | Uint8Array | UniversalAddress) {
    if (typeof address === "string") {
      // A denom address like "IBC/..."
      if (address.indexOf("/") !== -1) {
        const chunks = address.split("/");
        const data = fromHex(chunks[1]);
        CosmwasmAddress.validLength(data);

        this.address = data;
        this.prefix = chunks[0];
      } else {
        if (!CosmwasmAddress.isValidAddress(address))
          throw new Error(`Invalid Cosmwasm address:  ${address}`);

        const { data, prefix } = fromBech32(address);
        this.address = data;
        this.prefix = prefix;
      }
    } else if (address instanceof Uint8Array) {
      CosmwasmAddress.validLength(address);
      this.prefix = "";
      this.address = address;
    } else if (address instanceof UniversalAddress) {
      const addressBytes = address.toUint8Array();
      CosmwasmAddress.validLength(addressBytes);

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
      return CosmwasmAddress.validLength(maybe.data);
    } catch (e) {}
    return false;
  }

  private static validLength(address: Uint8Array): boolean {
    if (
      address.length !== CosmwasmAddress.contractAddressByteSize &&
      address.length !== CosmwasmAddress.accountAddressByteSize
    )
      throw new Error(
        `Invalid Cosmwasm address, expected ${CosmwasmAddress.contractAddressByteSize} ` +
          `or ${CosmwasmAddress.accountAddressByteSize} bytes but got ${address.length}`
      );

    return true;
  }

  equals(other: UniversalAddress): boolean {
    return other.equals(this.toUniversalAddress());
  }
}
