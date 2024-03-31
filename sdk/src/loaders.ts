import {
  NativeAddressCtr,
  Platform,
  PlatformUtils,
  RpcConnection,
  Signer,
} from "@wormhole-foundation/sdk-connect";

export interface PlatformDefinition<P extends Platform> {
  Platform: PlatformUtils<P>;
  Address: NativeAddressCtr;
  getSigner: (rpc: RpcConnection<P>, key: string, ...args: any) => Promise<Signer>;
  protocolLoaders: {
    [key: string]: () => Promise<any>;
  };
}

export type PlatformLoader<P extends Platform> = () => Promise<PlatformDefinition<P>>;

export const loaders = {
  Algorand: async () => (await import("./algorand.js")).default,
  Aptos: async () => (await import("./aptos.js")).default,
  Cosmwasm: async () => (await import("./cosmwasm.js")).default,
  Evm: async () => (await import("./evm.js")).default,
  Solana: async () => (await import("./solana.js")).default,
  Sui: async () => (await import("./sui.js")).default,
};

export async function load(platforms: Platform[]): Promise<PlatformDefinition<Platform>[]> {
  // return all specified platform loaders
  const filteredLoaders = platforms.map((platform) => {
    if (!(platform in loaders)) throw "Unknown platform: " + platform;
    // @ts-ignore
    return loaders[platform]!;
  }) as PlatformLoader<Platform>[];

  try {
    // Load platforms
    const platforms = await Promise.all(filteredLoaders.map((loader) => loader()));

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
