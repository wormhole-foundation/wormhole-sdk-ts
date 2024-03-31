import type { ConfigOverrides, Network, Platform } from "@wormhole-foundation/sdk-connect";
import { Wormhole } from "@wormhole-foundation/sdk-connect";
import { load } from "./loaders.js";

export * from "@wormhole-foundation/sdk-connect";
export * from "./loaders.js";

export async function wormhole<N extends Network>(
  network: N,
  platforms: Platform[],
  config?: ConfigOverrides<N>,
): Promise<Wormhole<N>> {
  const loaded = await load(platforms);
  return new Wormhole(
    network,
    loaded.map((l) => l.Platform),
    config,
  );
}
