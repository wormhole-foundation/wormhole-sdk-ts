import type {
  ConfigOverrides,
  Network,
  Platform,
  ProtocolName,
} from "@wormhole-foundation/sdk-connect";
import {
  NativeAddressCtr,
  PlatformUtils,
  RpcConnection,
  Signer,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";

export * from "@wormhole-foundation/sdk-connect";

export * from "./addresses.js";

export interface PlatformDefinition<P extends Platform> {
  Platform: PlatformUtils<P>;
  Address: NativeAddressCtr;
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  protocols: ProtocolLoaders;
}

export type ProtocolLoaders = {
  [key in ProtocolName]?: () => Promise<any>;
};

export type PlatformLoader<P extends Platform> = () => Promise<PlatformDefinition<P>>;

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
  config?: ConfigOverrides<N>,
): Promise<Wormhole<N>> {
  const loaded = (await loadPlatforms(platforms)).map((p) => p.Platform);
  return new Wormhole(network, loaded, config);
}
