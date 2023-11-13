import {
  Chain,
  isChain,
  Platform,
  chainToPlatform,
  ChainToPlatform,
} from "@wormhole-foundation/sdk-base";

//TODO BRRRR circular include!!
//I have yet to figure out how to get the equivalent of a forward declaration to work (without
//  yet again having to rely on global scope...)
//I first tried `declare class UniversalAddress {};` but this actually introduces a new, separate
//  type in this module rather than telling the compiler that we already have this type elsewhere
//I could also create an interface via `interface IUnverisalAddress {}` but that seems like an
//  even worse solution, as is just throwing everything into this file here and just brushing
//  things under the rug by not separating them out.
import { UniversalAddress } from "./universalAddress";

export interface Address {
  //unwrap returns the underlying native address type, e.g.:
  //  * a Uint8Array for UniversalAddress
  //  * a checksum hex string string for EVM(ethers)
  //  * a PublicKey for Solana
  //  * etc.
  unwrap(): unknown;
  toString(): string;
  toUint8Array(): Uint8Array;
  toUniversalAddress(): UniversalAddress;
  //static isValidAddress(str: string): boolean;

  //other ideas:
  //zeroAddress
  //verify(message: Uint8Array, signature: Uint8Array): boolean;
  //static byteSize(): number;
}

declare global {
  namespace Wormhole {
    export interface PlatformToNativeAddressMapping {}
  }
}

export type MappedPlatforms = keyof Wormhole.PlatformToNativeAddressMapping;

type ChainOrPlatformToPlatform<T extends Chain | Platform> = T extends Chain
  ? ChainToPlatform<T>
  : T;

type GetNativeAddress<T extends Platform> = T extends MappedPlatforms
  ? Wormhole.PlatformToNativeAddressMapping[T]
  : never;

export type NativeAddress<T extends Platform | Chain> = GetNativeAddress<
  ChainOrPlatformToPlatform<T>
>;

export type UniversalOrNative<T extends Platform | Chain> = UniversalAddress | NativeAddress<T>;

export type AccountAddress<T extends Chain | Platform> = UniversalOrNative<T>;
export type TokenAddress<T extends Chain | Platform> = UniversalOrNative<T> | "native";

export type ChainAddress<C extends Chain = Chain> = {
  readonly chain: C;
  readonly address: UniversalOrNative<C>;
};

type NativeAddressCtr = new (ua: UniversalAddress | string | Uint8Array) => Address;

const nativeFactory = new Map<Platform, NativeAddressCtr>();

export function registerNative<P extends Platform>(platform: P, ctr: NativeAddressCtr): void {
  if (nativeFactory.has(platform)) {
    console.error("Native address type for platform %s has already registered", platform);
    //throw new Error(`Native address type for platform ${platform} has already registered`);
    return;
  }

  nativeFactory.set(platform, ctr);
}

export function nativeIsRegistered<T extends Platform | Chain>(chainOrPlatform: T): boolean {
  const platform: Platform = isChain(chainOrPlatform)
    ? chainToPlatform.get(chainOrPlatform)!
    : chainOrPlatform;

  return nativeFactory.has(platform);
}

export function toNative<T extends Platform | Chain>(
  chainOrPlatform: T,
  ua: UniversalAddress | string | Uint8Array,
): NativeAddress<T> {
  const platform: Platform = isChain(chainOrPlatform)
    ? chainToPlatform.get(chainOrPlatform)!
    : chainOrPlatform;

  const nativeCtr = nativeFactory.get(platform);
  if (!nativeCtr) throw new Error(`No native address type registered for platform ${platform}`);

  return new nativeCtr(ua) as unknown as NativeAddress<T>;
}
