import {
  Network,
  Platform,
  PlatformUtils,
  RpcConnection,
  Signer,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";

export * from "@wormhole-foundation/sdk-connect";

export interface PlatformDefinition<P extends Platform> {
  Platform: PlatformUtils<P>;
  ChainContext: any;
  Address: any;
  Signer: any;
  getSigner: (rpc: RpcConnection<P>, key: string) => Promise<Signer>;
  protocols: {
    [key: string]: () => Promise<any>;
  };
}

export async function wormhole<N extends Network>(
  network: N,
  platforms: PlatformDefinition<Platform>[],
): Promise<Wormhole<N>> {
  // make sure all protocols are loaded
  try {
    await Promise.all(
      platforms.flatMap(async (p) =>
        Object.values(p.protocols).map(async (loaderFn) => await loaderFn()),
      ),
    );
  } catch (e) {
    console.error("Failed to load protocols", e);
    throw e;
  }

  return new Wormhole(
    network,
    platforms.map((p) => p.Platform),
  );
}
