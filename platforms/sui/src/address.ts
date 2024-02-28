import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import {
  Address,
  encoding,
  registerNative,
  UniversalAddress,
} from "@wormhole-foundation/connect-sdk";

import { SUI_SEPARATOR } from "./constants";
import { SuiPlatform } from "./platform";
import { _platform, AnySuiAddress } from "./types";

export const SuiZeroAddress = "0x";

export const trimSuiType = (type: string): string => type.replace(/(0x)(0*)/g, "0x");
export const isValidSuiType = (str: string): boolean => /^(0x)?[0-9a-fA-F]+::\w+::\w+$/.test(str);

// Adds leading 0s to the address to make it 32 bytes long
export function ensureFullSuiAddress(address: string) {
  if (address.length % 2 !== 0 || address.length < 66) {
    address = address.startsWith("0x") ? address.slice(2) : address;
    return "0x" + address.padStart(64, "0");
  }
  return address;
}

export const normalizeSuiType = (type: string): string => {
  const tokens = type.split(SUI_SEPARATOR);
  if (tokens.length !== 3) throw new Error(`Invalid Sui type: ${type}`);
  return [normalizeSuiAddress(tokens[0]!), tokens[1], tokens[2]].join(SUI_SEPARATOR);
};

export const getCoinTypeFromPackageId = (packageId: string): string => {
  return new SuiAddress(packageId).getCoinType();
};

export const getPackageIdFromType = (type: string): string => {
  return new SuiAddress(type).getPackageId();
};

export const getTableKeyType = (tableType: string): string => {
  const match = trimSuiType(tableType).match(/0x2::table::Table<(.*)>/);
  if (!match) throw new Error(`Invalid table type: ${tableType}`);
  if (match.length < 2) throw new Error(`Invalid table type: ${tableType}`);

  const [keyType] = match[1]!.split(",");
  if (!keyType || !isValidSuiType(keyType!)) throw new Error(`Invalid key type: ${keyType}`);

  return keyType;
};

export class SuiAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform = SuiPlatform._platform;

  // Full 32 bytes of Address
  readonly address: Uint8Array;
  // Optional module and contract name
  readonly module: string | undefined;

  constructor(address: AnySuiAddress) {
    if (SuiAddress.instanceof(address)) {
      this.address = address.address;
      this.module = address.module;
    } else if (UniversalAddress.instanceof(address)) {
      this.address = address.toUint8Array();
    } else if (typeof address === "string") {
      // If we've got an address of the form `0x1234...::module::...` then
      // stuff anything after the first `::` into the module field
      // and continue processing the address
      if (isValidSuiType(address)) {
        const chunks = address.split(SUI_SEPARATOR);
        this.module = chunks.slice(1).join(SUI_SEPARATOR);
        address = chunks[0]!;
      }

      address = ensureFullSuiAddress(address);
      if (!encoding.hex.valid(address)) throw new Error("Invalid Sui address: " + address);

      this.address = encoding.hex.decode(address);
    } else {
      this.address = address as Uint8Array;
    }
  }

  unwrap(): string {
    const packageId = this.getPackageId();
    const module = this.module ? SUI_SEPARATOR + this.module : "";
    return `${packageId}${module}`;
  }

  toString(): string {
    return this.unwrap();
  }
  toNative() {
    return this;
  }
  toUint8Array() {
    return this.address;
  }
  toUniversalAddress() {
    return new UniversalAddress(this.toUint8Array());
  }

  getPackageId(): string {
    return ensureFullSuiAddress(encoding.hex.encode(this.address, true));
  }

  getCoinType(): string {
    return [this.getPackageId(), "coin", "COIN"].join(SUI_SEPARATOR);
  }

  static instanceof(address: any): address is SuiAddress {
    return address.constructor.platform === SuiAddress.platform;
  }

  equals(other: SuiAddress | UniversalAddress): boolean {
    if (SuiAddress.instanceof(other)) {
      return other.unwrap() === this.unwrap();
    } else {
      return this.toUniversalAddress().equals(other);
    }
  }
}

declare global {
  namespace Wormhole {
    export interface PlatformToNativeAddressMapping {
      Sui: SuiAddress;
    }
  }
}

registerNative(_platform, SuiAddress);
