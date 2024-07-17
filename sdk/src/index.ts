import type {
  Network,
  WormholeConfigOverrides,
  Platform,
  ProtocolName,
  ChainConfigOverrides,

  ChainContext,
  NativeAddressCtr,
  PlatformToChains,
  PlatformUtils,
  RpcConnection,
  Signer} from "@wormhole-foundation/sdk-connect";
import {
  Wormhole,
} from "@wormhole-foundation/sdk-connect";

/**
 * PlatformDefinition is a type that contains the types necessary to
 * interact with the platform or any of the enabled chains that run on the it.
 */
export interface PlatformDefinition<P extends Platform> {
  /** Platform implements PlatformUtils and can be used as a constructor to create a configured PlatformContext */
  Platform: PlatformUtils<P>;
  /** Address implements the logic to properly parse or format an address for this Platform */
  Address: NativeAddressCtr;
  /** creates a new ChainContext object for a specific Network and Chain */
  getChain: <N extends Network, C extends PlatformToChains<P>>(
    network: N,
    chain: C,
    overrides?: ChainConfigOverrides<N, C>,
  ) => ChainContext<N, C, P>;
  /** Provides a local signer that implements the Signer interface for the platform */
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  /** A map of ProtocolName => ProtocolLoader for dynamic imports of protocols  */
  protocols: ProtocolLoaders;
}

export function isPlatformDefinition(obj: any): obj is PlatformDefinition<Platform> {
  return obj && obj.Platform && obj.Address && obj.getSigner && obj.protocols;
}

export type PlatformLoader<P extends Platform> = () => Promise<PlatformDefinition<P>>;

export type ProtocolLoaders = {
  [key in ProtocolName]?: () => Promise<any>;
};

/**
 * load the platforms and their protocols by
 *  first calling the import function for each platform
 *  then calling the import function for each protocol
 *
 * @param loaders the list of PlatformLoaders to load
 */
export async function loadPlatforms(
  loaders: PlatformLoader<Platform>[],
): Promise<PlatformDefinition<Platform>[]> {
  try {
    // Load platforms
    const platforms = await Promise.all(loaders.map(async (loader) => loader()));

    // Load all protocols by default
    await Promise.all(platforms.map(async (p) => await loadProtocols(p)));

    // return platforms
    return platforms;
  } catch (e) {
    console.error("Failed to load required packages", e);
    throw e;
  }
}

/**
 * loads the protocols for a given platform by calling the import function for each protocol
 *  if a list of protocols is provided, only those protocols will be loaded
 *
 * @param platform the PlatformDefinition to load the protocols for
 * @param protocols the list of protocols to load
 * @throws if any of the protocols fail to load
 */
export async function loadProtocols<P extends Platform>(
  platform: PlatformDefinition<P>,
  protocols?: ProtocolName[],
): Promise<void> {
  try {
    let toLoad = Object.entries(platform.protocols);
    if (protocols) toLoad.filter(([name]) => protocols.includes(name as ProtocolName));
    await Promise.all(toLoad.map(([, loaderFn]) => loaderFn()));
  } catch (e) {
    console.error("Failed to load required packages", e);
    throw e;
  }
}

export async function wormhole<N extends Network>(
  network: N,
  platforms: PlatformLoader<any>[],
  config?: WormholeConfigOverrides<N>,
): Promise<Wormhole<N>> {
  const loaded = (await loadPlatforms(platforms)).map((p) => p.Platform);
  return new Wormhole(network, loaded, config);
}

export * from "@wormhole-foundation/sdk-connect";
export * from "./addresses.js";
