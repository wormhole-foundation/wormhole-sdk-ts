import type { ConfigOverrides, Network } from "@wormhole-foundation/sdk-connect";
import { Wormhole } from "@wormhole-foundation/sdk-connect";
import { PlatformDefinition } from "./loaders.js";

export * from "@wormhole-foundation/sdk-connect";

export * from "./loaders.js";

export async function wormhole<N extends Network>(
  network: N,
  platformLoaders: (() => Promise<PlatformDefinition<any>>)[],
  config?: ConfigOverrides<N>,
): Promise<Wormhole<N>> {
  try {
    // Load platforms
    const platforms = await Promise.all(
      platformLoaders.map(async (platformLoader) => await platformLoader()),
    );

    // Load all protocols
    await Promise.all(
      platforms.map(
        async (p) =>
          await Promise.all(
            Object.values(p.protocolLoaders).map(async (loaderFn) => await loaderFn()),
          ),
      ),
    );

    return new Wormhole(
      network,
      platforms.map((p) => p.Platform),
      config,
    );
  } catch (e) {
    console.error("Failed to load required packages", e);
    throw e;
  }
}
