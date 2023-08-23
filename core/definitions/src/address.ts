import {
  ChainName,
  isChain,
  PlatformName,
  chainToPlatform,
  ChainToPlatformMapping,
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

type ChainOrPlatformToPlatform<T extends ChainName | PlatformName> =
  T extends ChainName ? ChainToPlatformMapping<T> : T;
export type NativeAddress<T extends PlatformName | ChainName> =
  ChainOrPlatformToPlatform<T> extends MappedPlatforms
    ? Wormhole.PlatformToNativeAddressMapping[ChainOrPlatformToPlatform<T>]
    : never;

export type UniversalOrNative<P extends PlatformName> =
  | UniversalAddress
  | NativeAddress<P>;

export type ChainAddressPair<C extends ChainName = ChainName> = readonly [
  C,
  UniversalAddress | NativeAddress<C>
];

type NativeAddressCtr = new (ua: UniversalAddress) => Address;

const nativeFactory = new Map<PlatformName, NativeAddressCtr>();

export function registerNative<P extends MappedPlatforms>(
  platform: P,
  ctr: NativeAddressCtr
): void {
  if (nativeFactory.has(platform))
    throw new Error(
      `Native address type for platform ${platform} has already registered`
    );

  nativeFactory.set(platform, ctr);
}

export function toNative<T extends PlatformName | ChainName>(
  chainOrPlatform: T,
  ua: UniversalAddress
): NativeAddress<T> {
  const platform: PlatformName = isChain(chainOrPlatform)
    ? chainToPlatform(chainOrPlatform)
    : chainOrPlatform;
  const nativeCtr = nativeFactory.get(platform);
  if (!nativeCtr)
    throw new Error(
      `No native address type registered for platform ${platform}`
    );

  return new nativeCtr(ua) as unknown as NativeAddress<T>;
}
