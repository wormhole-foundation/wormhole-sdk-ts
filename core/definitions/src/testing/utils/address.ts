import {
  Chain,
  chainToPlatform,
  encoding,
  isPlatform,
  platformToChains,
} from "@wormhole-foundation/sdk-base";
import crypto from "crypto";
import { ChainAddress, NativeAddress, UniversalAddress, toNative } from "../../";

// return a random buffer of length n
function randomBytes(n: number): Uint8Array {
  const buff = new Uint8Array(n);
  crypto.getRandomValues(buff);
  return buff;
}

// get a random 20 byte address
function fake20ByteAddress(): string {
  const buff = randomBytes(20);
  return encoding.hex.encode(buff);
}

// get a random 32 byte address
function fake32ByteAddress(): string {
  const buff = randomBytes(32);
  return encoding.hex.encode(buff);
}

// make a random native address for a given chain
export function makeNativeAddressHexString(chain: Chain): string {
  switch (chainToPlatform(chain)) {
    case "Evm":
      return fake20ByteAddress();
    case "Cosmwasm":
      return fake20ByteAddress();
    default:
      return fake32ByteAddress();
  }
}

// make a random ChainAddress for a given chain
export function makeChainAddress<C extends Chain>(chain: C): ChainAddress<C> {
  const address = makeUniversalAddress(chain);
  return { chain, address: address.toNative(chain) };
}

// make a random ChainAddress for a given chain
export function makeUniversalChainAddress(chain: Chain): ChainAddress<Chain> {
  const address = makeUniversalAddress(chain);
  return { chain, address };
}

export function makeUniversalAddress(chain: Chain): UniversalAddress {
  const nativeAddress = makeNativeAddressHexString(chain);
  return new UniversalAddress("0x" + nativeAddress.padStart(64, "0"));
}
// make a random NativeAddress for a given chain
export function makeNativeAddress<T extends Chain>(chain: T): NativeAddress<T> {
  let cn: Chain;
  if (isPlatform(chain)) {
    // just grab the first one
    cn = platformToChains(chain)[0];
  } else {
    cn = chain;
  }

  return toNative(cn, makeNativeAddressHexString(cn)) as NativeAddress<T>;
}
