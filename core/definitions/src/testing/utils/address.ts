import crypto from "crypto";
import {
  Chain,
  Platform,
  chainToPlatform,
  encoding,
  isPlatform,
  platformToChains,
} from "@wormhole-foundation/sdk-base";
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
export function makeChainAddress(chain: Chain): ChainAddress {
  const nativeAddress = makeNativeAddressHexString(chain);
  const address = new UniversalAddress("0x" + nativeAddress.padStart(64, "0"));
  return { chain, address };
}

// make a random NativeAddress for a given chain
export function makeNativeAddress<T extends Chain | Platform>(chain: T): NativeAddress<T> {
  let cn: Chain;
  if (isPlatform(chain)) {
    // just grab the first one
    cn = platformToChains(chain)[0];
  } else {
    cn = chain;
  }

  return toNative(cn, makeNativeAddressHexString(cn)) as NativeAddress<T>;
}
