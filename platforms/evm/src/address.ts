import {
  Address,
  UniversalAddress,
  registerNative,
} from '@wormhole-foundation/sdk-definitions';

import { ethers } from 'ethers';

export class EvmAddress implements Address {
  static readonly byteSize = 20;

  //stored as checksum address
  private readonly address: string;

  constructor(address: string | Uint8Array | UniversalAddress) {
    if (typeof address === 'string') {
      if (!EvmAddress.isValidAddress(address))
        throw new Error(
          `Invalid EVM address, expected ${EvmAddress.byteSize}-byte hex string but got ${address}`,
        );

      this.address = ethers.getAddress(address);
    } else if (address instanceof Uint8Array) {
      if (address.length !== EvmAddress.byteSize)
        throw new Error(
          `Invalid EVM address, expected ${EvmAddress.byteSize} bytes but got ${address.length}`,
        );

      this.address = ethers.getAddress(ethers.hexlify(address));
    } else if (address instanceof UniversalAddress) {
      // If its a universal address and we want it to be an ethereum address,
      // we need to chop off the first 12 bytes of padding
      const addressBytes = address.toUint8Array();
      // double check to make sure there are no non zero bytes
      if (
        addressBytes.slice(0, 12).some((v) => {
          v !== 0;
        })
      )
        throw new Error(`Invalid EVM address ${address}`);

      const suffix = Buffer.from(addressBytes.slice(12)).toString('hex');
      this.address = ethers.getAddress(suffix);
    } else throw new Error(`Invalid EVM address ${address}`);
  }

  unwrap(): string {
    return this.address;
  }
  toString() {
    return this.address;
  }
  toUint8Array() {
    return ethers.getBytes(this.address);
  }
  toUniversalAddress() {
    return new UniversalAddress(
      ethers.zeroPadValue(this.address, UniversalAddress.byteSize),
    );
  }
  static isValidAddress(address: string) {
    return ethers.isAddress(address);
  }
}

declare global {
  namespace Wormhole {
    interface PlatformToNativeAddressMapping {
      Evm: EvmAddress;
    }
  }
}

registerNative('Evm', EvmAddress);
