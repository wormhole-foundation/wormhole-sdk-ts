import {
  Chain,
  ChainToPlatform,
  Platform,
  chainToPlatform,
  platformToAddressFormat,
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
  namespace WormholeNamespace {
    export interface PlatformToNativeAddressMapping {}
  }
}

export type MappedPlatforms = keyof WormholeNamespace.PlatformToNativeAddressMapping;

type GetNativeAddress<T extends Platform> = T extends MappedPlatforms
  ? WormholeNamespace.PlatformToNativeAddressMapping[T]
  : never;

export type NativeAddress<C extends Chain> = GetNativeAddress<ChainToPlatform<C>>;

export type UniversalOrNative<T extends Chain> = UniversalAddress | NativeAddress<T>;

export type AccountAddress<T extends Chain> = UniversalOrNative<T>;
export type TokenAddress<T extends Chain> = UniversalOrNative<T> | "native";

export type ChainAddress<C extends Chain = Chain> = {
  readonly chain: C;
  readonly address: UniversalOrNative<C>;
};

type NativeAddressCtr = new (ua: UniversalAddress | string | Uint8Array) => Address;

const nativeFactory = new Map<Platform, NativeAddressCtr>();

export function registerNative<P extends Platform>(platform: P, ctr: NativeAddressCtr): void {
  if (nativeFactory.has(platform)) {
    console.warn("Native address type for platform %s has already registered", platform);
    //throw new Error(`Native address type for platform ${platform} has already registered`);
    return;
  }

  nativeFactory.set(platform, ctr);
}

export function nativeIsRegistered<C extends Chain>(chain: C): boolean {
  const platform: Platform = chainToPlatform.get(chain)!;
  return nativeFactory.has(platform);
}

export function toNative<C extends Chain>(
  chain: C,
  ua: UniversalAddress | string | Uint8Array,
): NativeAddress<C> {
  const platform: Platform = chainToPlatform.get(chain)!;
  const nativeCtr = nativeFactory.get(platform);
  if (!nativeCtr) throw new Error(`No native address type registered for platform ${platform}`);
  return new nativeCtr(ua) as unknown as NativeAddress<C>;
}

export function toUniversal<C extends Chain>(
  chain: C,
  address: string | Uint8Array,
): UniversalAddress {
  const platform: Platform = chainToPlatform.get(chain)!;
  return new UniversalAddress(address, platformToAddressFormat.get(platform)!);
}
