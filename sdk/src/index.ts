import type { ConfigOverrides, Network, Platform } from "@wormhole-foundation/sdk-connect";
import {
  NativeAddressCtr,
  PlatformUtils,
  RpcConnection,
  Signer,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";

export * from "@wormhole-foundation/sdk-connect";

export interface PlatformDefinition<P extends Platform> {
  Platform: PlatformUtils<P>;
  Address: NativeAddressCtr;
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  protocolLoaders: {
    [key: string]: () => Promise<any>;
  };
}

export type PlatformLoader<P extends Platform> = () => Promise<PlatformDefinition<P>>;

export async function load(
  loaders: PlatformLoader<Platform>[],
): Promise<PlatformDefinition<Platform>[]> {
  try {
    // Load platforms
    const platforms = await Promise.all(loaders.map(async (loader) => loader()));

    // Load all protocols by default
    await Promise.all(
      platforms.map(
        async (p) =>
          await Promise.all(Object.values(p.protocolLoaders).map((loaderFn) => loaderFn())),
      ),
    );

    // return platforms
    return platforms;
  } catch (e) {
    console.error("Failed to load required packages", e);
    throw e;
  }
}

export async function wormhole<N extends Network>(
  network: N,
  platforms: PlatformLoader<Platform>[],
  config?: ConfigOverrides<N>,
): Promise<Wormhole<N>> {
  const loaded = (await load(platforms)).map((p) => p.Platform);
  return new Wormhole(network, loaded, config);
}
