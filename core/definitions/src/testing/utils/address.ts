import crypto from "crypto";
import {
  ChainName,
  PlatformName,
  chainToPlatform,
  isPlatform,
  platformToChains,
} from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  NativeAddress,
  UniversalAddress,
  toNative,
} from "../../";

// return a random buffer of length n
function randomBuffer(n: number): Buffer {
  const buff = new Uint8Array(n);
  crypto.getRandomValues(buff);
  return Buffer.from(buff);
}

// get a random 20 byte address
function fake20ByteAddress(): string {
  const buff = randomBuffer(20);
  return buff.toString("hex");
}

// get a random 32 byte address
function fake32ByteAddress(): string {
  const buff = randomBuffer(32);
  return buff.toString("hex");
}

// make a random native address for a given chain
export function makeNativeAddressHexString(chain: ChainName): string {
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
export function makeChainAddress(chain: ChainName): ChainAddress {
  const nativeAddress = makeNativeAddressHexString(chain);
  const address = new UniversalAddress("0x" + nativeAddress.padStart(64, "0"));
  return { chain, address };
}

// make a random NativeAddress for a given chain
export function makeNativeAddress<T extends ChainName | PlatformName>(
  chain: T,
): NativeAddress<T> {
  let cn: ChainName;
  if (isPlatform(chain)) {
    // just grab the first one
    cn = platformToChains(chain)[0];
  } else {
    cn = chain;
  }

  return toNative(cn, makeNativeAddressHexString(cn)) as NativeAddress<T>;
}
