import type {
  Chain,
  ChainContext,
  ConfigOverrides,
  NativeAddress,
  Network,
  Platform,
  PlatformToChains,
  PlatformUtils,
  RpcConnection,
  Signer} from "@wormhole-foundation/sdk-connect";
import {
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
    new (...args: any): ChainContext<N, C, P>;
  };
  Address: {
    new (...args: any): NativeAddress<PlatformToChains<P>>;
  };
  Signer: {
    new (...args: any): Signer;
  };
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  protocols: {
    [key: string]: () => Promise<any>;
  };
}

export async function wormhole<N extends Network>(
  network: N,
  platformLoaders: (() => Promise<PlatformDefinition>)[],
  config?: ConfigOverrides,
): Promise<Wormhole<N>> {
  // make sure all protocols are loaded
  try {
    const platforms = await Promise.all(
      platformLoaders.map(async (platformLoader) => await platformLoader()),
    );

    await Promise.all(
      platforms.map(
        async (p) =>
          await Promise.all(Object.values(p.protocols).map(async (loaderFn) => await loaderFn())),
      ),
    );

    return new Wormhole<N>(
      network,
      platforms.map((p) => p.Platform),
      config,
    );
  } catch (e) {
    console.error("Failed to load required packages", e);
    throw e;
  }
}
