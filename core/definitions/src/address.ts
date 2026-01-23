import type { Chain, ChainToPlatform, Platform } from "@wormhole-foundation/sdk-base";
import { chainToPlatform, platformToAddressFormat } from "@wormhole-foundation/sdk-base";
import type { WormholeRegistry } from "./registry.js";

//TODO BRRRR circular include!!
//I have yet to figure out how to get the equivalent of a forward declaration to work (without
//  yet again having to rely on global scope...)
//I first tried `declare class UniversalAddress {};` but this actually introduces a new, separate
//  type in this module rather than telling the compiler that we already have this type elsewhere
//I could also create an interface via `interface IUnverisalAddress {}` but that seems like an
//  even worse solution, as is just throwing everything into this file here and just brushing
//  things under the rug by not separating them out.
import { UniversalAddress } from "./universalAddress.js";

/**
 * Address is the base interface all address types must implement.
 *
 * Represents a parsed address
 */
export interface Address {
  /**
   * unwrap returns the underlying native address type, e.g.:
   * a Uint8Array for UniversalAddress
   * a checksum hex string string for EVM(ethers)
   * a PublicKey for Solana
   * etc.
   */
  unwrap(): unknown;
  /** Return the address in its canonical string format */
  toString(): string;
  /** Return the bytes for the address */
  toUint8Array(): Uint8Array;
  /** Return an Address that has been converted to its Universal representation */
  toUniversalAddress(): UniversalAddress;
}

export interface ChainSpecificAddress extends Address {
  setChain(chain: Chain): void;
}
export function isChainSpecificAddress(thing: any): thing is ChainSpecificAddress {
  return typeof thing === "object" && "setChain" in thing;
}

export type MappedPlatforms = keyof WormholeRegistry.PlatformToNativeAddressMapping;

/** Utility type to map platform to its native address implementation */
type GetNativeAddress<P extends Platform> = P extends MappedPlatforms
  ? WormholeRegistry.PlatformToNativeAddressMapping[P]
  : never;

export type NativeAddressCtr = new (ua: UniversalAddress | string | Uint8Array) => Address;

/** An address that has been parsed into its Native Address type */
export type NativeAddress<C extends Chain> = GetNativeAddress<ChainToPlatform<C>>;

/** A union type representing a parsed address */
export type UniversalOrNative<C extends Chain> = UniversalAddress | NativeAddress<C>;

/** An address that represents an account  */
export type AccountAddress<C extends Chain> = UniversalOrNative<C>;

/**
 * ChainAddress represents the parsed address for a given chain
 * and comes with the context of which chain its relevant for
 */
export type ChainAddress<C extends Chain = Chain> = {
  readonly chain: C;
  readonly address: UniversalOrNative<C>;
};

const nativeFactory = new Map<Platform, NativeAddressCtr>();

export function registerNative<P extends Platform>(platform: P, ctr: NativeAddressCtr): void {
  if (nativeFactory.has(platform)) return;
  // TODO:
  // throw new Error(`Native address type for platform ${platform} has already registered`);
  nativeFactory.set(platform, ctr);
}

export function nativeIsRegistered<C extends Chain>(chain: C): boolean {
  const platform: Platform = chainToPlatform.get(chain)!;
  return nativeFactory.has(platform);
}

/** Parse an address into its NativeAddress representation */
export function toNative<C extends Chain>(
  chain: C,
  ua: UniversalAddress | string | Uint8Array,
): NativeAddress<C> {
  const platform: Platform = chainToPlatform.get(chain)!;
  const nativeCtr = nativeFactory.get(platform);
  if (!nativeCtr)
    throw new Error(
      `No native address type registered for platform ${platform}, import the platform directly or, if using sdk package, import the addresses conditional export`,
    );
  try {
    const nativeAddress = new nativeCtr(ua) as unknown as NativeAddress<C>;

    if (isChainSpecificAddress(nativeAddress)) {
      // idk why but this typeguard doesnt actually work?
      (nativeAddress as ChainSpecificAddress).setChain(chain);
    }

    return nativeAddress;
  } catch (e: any) {
    const err = `Error parsing address as a native ${chain} address: ${e.message}`;

    if (UniversalAddress.instanceof(ua)) {
      throw err;
    } else {
      // If we were given a string or Uint8Array value, which is ambiguously either a
      // NativeAddress or UniversalAddress, and it failed to parse directly
      // as a NativeAddress, we try one more time to parse it as a UniversalAddress
      // first and then convert that to a NativeAddress.
      return (new UniversalAddress(ua)).toNative(chain);
    }
  }
}

export function toUniversal<C extends Chain>(
  chain: C,
  address: string | Uint8Array,
): UniversalAddress {
  const platform: Platform = chainToPlatform.get(chain)!;
  return new UniversalAddress(address, platformToAddressFormat.get(platform)!);
}
