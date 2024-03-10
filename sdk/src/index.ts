import {
  Chain,
  ChainContext,
  NativeAddress,
  Network,
  Platform,
  PlatformToChains,
  PlatformUtils,
  RpcConnection,
  Signer,
  Wormhole,
} from "@wormhole-foundation/sdk-connect";

export * from "@wormhole-foundation/sdk-connect";

export interface PlatformDefinition<
  N extends Network = Network,
  P extends Platform = Platform,
  C extends Chain = PlatformToChains<P>,
> {
  Platform: PlatformUtils<P>;
  ChainContext: {
    new <CCN extends N = N, CCC extends C = C>(...args: any): ChainContext<N, C, P>;
  };
  Address: {
    new (...args: any): NativeAddress<PlatformToChains<P>>;
  };
  Signer: {
    new (...args: any): Signer;
  };
  getSigner: (rpc: RpcConnection<P>, key: string) => Promise<Signer>;
  protocols: {
    [key: string]: () => Promise<any>;
  };
}

export async function wormhole<N extends Network>(
  network: N,
  platforms: PlatformDefinition<N>[],
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
