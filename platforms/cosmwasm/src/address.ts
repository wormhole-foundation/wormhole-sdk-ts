import type { Address } from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, encoding, registerNative } from "@wormhole-foundation/sdk-connect";
import type { AnyCosmwasmAddress } from "./types.js";
import { _platform } from "./types.js";

/*
Cosmos Addresses
-----
There are at least 5 types of addresses in Cosmos:

  Native Denom
    ex: "uatom"

    address = [] // 0 bytes
    domain = undefined
    denom = "uatom"
    denomType = "native"

  Contract Address
    ex: "wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk"

    address = [0x...] // 32 bytes
    domain = "wormhole"
    denom = undefined
    denomType = undefined

  Account Address
    ex: "cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0eph6dd02"

    address = [0x...] // 20 bytes
    domain = "cosmos"
    denom = undefined
    denomType = undefined

  IBC Denom
    ex: IBC/BAEAC83736444C09656FBE666FB625974FCCDEE566EB700EBFD2642C5F6CF13A

    address = [0x...] // 32 bytes
    domain = undefined
    denom = undefined
    denomType = "IBC"

  Factory Address
    ex: "factory/inj17vytdwqczqz72j65saukplrktd4gyfme5agf6c/avax"

    address = [0x...] 20 bytes
    domain = "inj"
    denom =  "avax"
    denomType = "factory"

  Transfer Denom
    ex: transfer/channel-486/factory/wormhole1ctnjk7an90lz5wjfvr3cf6x984a8cjnv8dpmztmlpcq4xteaa2xs9pwmzk/6vxRV62YN1CTZeQM5ZfvCZDCVA4nLhtZcLxziYa7xYqb

    address = [0x...] 32 bytes
    domain = "wormhole"
    denom = "6vxRV62YN1CTZeQM5ZfvCZDCVA4nLhtZcLxziYa7xYqb"
    denomType = "transfer/channel-486/factory"
*/

// Factory type addresses may have hex or b64 or bech32 encoded addresses
function tryDecode(data: string): { data: Uint8Array; prefix?: string } {
  try {
    const decoded = encoding.bech32.decodeToBytes(data);
    return { data: decoded.bytes, prefix: decoded.prefix };
  } catch {}

  try {
    return { data: encoding.hex.decode(data) };
  } catch {}

  try {
    return { data: encoding.b64.decode(data) };
  } catch {}

  throw new Error(`Cannot decode: ${data}`);
}

export class CosmwasmAddress implements Address {
  static readonly contractAddressByteSize = 32;
  static readonly accountAddressByteSize = 20;
  public readonly platform = _platform;

  // the actual bytes of the address
  readonly address: Uint8Array;

  // The domain is the prefix for the address, like "cosmos" or "ibc"
  readonly domain?: string;
  // The denom is the token name, like "uatom" or "usdc"
  readonly denom?: string;
  // The denomType is "native", "ibc", or "factory"
  readonly denomType?: string;

  constructor(address: AnyCosmwasmAddress) {
    if (CosmwasmAddress.instanceof(address)) {
      const a = address as unknown as CosmwasmAddress;
      this.address = a.address;
      this.domain = a.domain;
      this.denom = a.denom;
      this.denomType = a.denomType;
      return;
    }

    if (typeof address === "string") {
      // A native denom like "uatom"
      if (address.length <= 8) {
        this.address = new Uint8Array(0);
        this.denom = address;
        this.denomType = "native";
        return;
      }

      if (address.indexOf("/") !== -1) {
        // A denom address like "ibc/..." or "factory/..." or "transfer/channel-${id}/factory/..."
        const chunks = address.split("/");

        // It's a `transfer/...` denom
        if (chunks.length >= 3) {
          // Address will be second from the last
          const { data, prefix } = tryDecode(chunks[chunks.length - 2]!);
          this.address = data;
          this.domain = prefix;
          this.denom = chunks[chunks.length - 1];
          this.denomType = chunks.slice(0, chunks.length - 2).join("/");
        } else {
          const { data } = tryDecode(chunks[1]!);
          this.address = data;
          this.denomType = chunks[0];
        }
      } else {
        // should be a contract or account address by now
        if (!CosmwasmAddress.isValidAddress(address))
          throw new Error(`Invalid Cosmwasm address:  ${address}`);

        const { bytes: data, prefix } = encoding.bech32.decodeToBytes(address);
        this.address = data;
        this.domain = prefix;
      }
    } else if (address instanceof Uint8Array) {
      this.address = address;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else throw new Error(`Invalid Cosmwasm address ${address}`);

    if (!CosmwasmAddress.validAddressLength(this.address)) {
      throw new Error("Expected 20 or 32 bytes address");
    }
  }

  unwrap(): string {
    return this.toString();
  }

  toString(): string {
    // Coin address
    if (this.denomType !== undefined) {
      // native asset denom
      if (this.denomType === "native") return this.denom!;

      // ibc/hex
      if (this.denomType === "ibc") {
        // NOTE: this is case sensitive, should be `ibc` not `IBC`
        return `${this.denomType.toLowerCase()}/${encoding.hex.encode(this.address).toUpperCase()}`;
      }

      // ?/factory/address/denom
      return `${this.denomType}/${CosmwasmAddress.encode(this.domain!, this.address)}/${
        this.denom
      }`;
    }

    // contract or account address
    return CosmwasmAddress.encode(this.domain!, this.address);
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
      const maybe = encoding.bech32.decodeToBytes(address);
      return CosmwasmAddress.validAddressLength(maybe.bytes);
    } catch {}
    return false;
  }
  static encode(prefix: string, address: Uint8Array): string {
    return encoding.bech32.encode(prefix, encoding.bech32.toWords(address));
  }

  private static validAddressLength(address: Uint8Array): boolean {
    if (
      address.length !== CosmwasmAddress.contractAddressByteSize &&
      address.length !== CosmwasmAddress.accountAddressByteSize
    )
      throw new Error(
        `Invalid Cosmwasm address, expected ${CosmwasmAddress.contractAddressByteSize} ` +
          `or ${CosmwasmAddress.accountAddressByteSize} bytes but got ${address.length}`,
      );

    return true;
  }

  static instanceof(address: any): address is CosmwasmAddress {
    return address.platform === _platform;
  }

  equals(other: CosmwasmAddress | UniversalAddress): boolean {
    if (CosmwasmAddress.instanceof(other)) {
      return this.toString() === other.toString();
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare module "@wormhole-foundation/sdk-connect" {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Cosmwasm: CosmwasmAddress;
    }
  }
}

registerNative(_platform, CosmwasmAddress);
