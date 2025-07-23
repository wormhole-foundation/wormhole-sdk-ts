import { Address, UniversalAddress, registerNative } from "@wormhole-foundation/sdk-connect";
import { _platform, AnyStacksAddress } from "./types.js";
import { Address as TransactionsAddress } from "@stacks/transactions";

export const StacksZeroAddress = 'SP000000000000000000002Q6VF78';

export class StacksAddress implements Address {
  static readonly byteSize = 20; // Assuming 20 bytes like EVM
  static readonly platform = _platform;
  readonly type: string = 'Native';

  readonly address: string

  constructor(address: AnyStacksAddress) {
    if(StacksAddress.instanceof(address)) {
      const a = address as unknown as StacksAddress;
      this.address = a.address;
      return;
    }

    if(typeof address === 'string') {
      if(!StacksAddress.isValidAddress(address)) {
        throw new Error(`Invalid Stacks address ${address}`);
      }
      this.address = address;
    // FG TODO Uint8Array
    } else {
      throw new Error(`Invalid Stacks address ${address}`);
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
    throw new Error("Method not implemented.");
  }
  toUniversalAddress(): UniversalAddress {
    // FG TODO
    throw new Error("Method not implemented.");
  }
  
  static isValidAddress(address: string): boolean {
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
