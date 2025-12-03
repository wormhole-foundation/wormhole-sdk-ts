import { Address, UniversalAddress, keccak256, registerNative } from "@wormhole-foundation/sdk-connect";
import { _platform, AnyStacksAddress } from "./types.js";
import { Address as TransactionsAddress } from "@stacks/transactions";

export const StacksZeroAddress = 'SP000000000000000000002Q6VF78';

export class StacksAddress implements Address {
  static readonly byteSize = 32;
  static readonly platform = _platform;
  readonly type: string = 'Native';

  readonly address: string
  readonly native: string

  constructor(address: AnyStacksAddress) {
    if(typeof address === 'string') {
      this.address = keccak256(address).toString();
      this.native = address;
    } else {
      this.address = keccak256(address.toString()).toString();
      this.native = address.toString();
    }
  }
  unwrap(): string {
    return this.native;
  }

  toString(): string {
    return this.native;
  }

  toNative() {
    return this;
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(Buffer.from(this.address))
  }

  toUniversalAddress(): UniversalAddress {
    return new UniversalAddress(this.native, "string")
  }
  
  static isValidAddress(address: string): boolean {
    if(address.startsWith("0x")) {
      return true;
    }
    try {
      TransactionsAddress.parse(address);
      return true;
    } catch(error) {
      return false;
    }
  }

  static instanceof(address: any): address is StacksAddress {
    return address.constructor.platform === StacksAddress.platform;
  }
  
  equals(other: StacksAddress | UniversalAddress): boolean {
    if (StacksAddress.instanceof(other)) {
      return other.address === this.address;
    } else {
      return other.equals(this.toUniversalAddress());
    }
  }
}

declare module '@wormhole-foundation/sdk-connect' {
  export namespace WormholeRegistry {
    interface PlatformToNativeAddressMapping {
      Stacks: StacksAddress;
    }
  }
}

registerNative(_platform, StacksAddress);
