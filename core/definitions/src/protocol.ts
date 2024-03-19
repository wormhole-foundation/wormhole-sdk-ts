import type { Chain, Network, Platform } from "@wormhole-foundation/sdk-base";
import { chainToPlatform, isChain } from "@wormhole-foundation/sdk-base";
import type { RpcConnection } from "./rpc.js";
import type { ChainsConfig } from "./types.js";
import type { WormholeRegistry } from "./registry.js";

/** A string type representing the name of a protocol */
export type ProtocolName = keyof WormholeRegistry.ProtocolToPlatformMapping;
type MappedProtocolPlatforms = keyof WormholeRegistry.ProtocolToPlatformMapping[ProtocolName];

export type EmptyPlatformMap<P extends Platform, PN extends ProtocolName> = Map<
  P,
  ProtocolInitializer<P, PN>
>;

export type ProtocolImplementation<
  T extends Platform,
  PN extends ProtocolName,
> = PN extends ProtocolName
  ? T extends MappedProtocolPlatforms
    ? WormholeRegistry.ProtocolToPlatformMapping[PN][T]
    : any
  : never;

export interface ProtocolInitializer<P extends Platform, PN extends ProtocolName> {
  fromRpc(
    rpc: RpcConnection<P>,
    config: ChainsConfig<Network, P>,
  ): Promise<ProtocolImplementation<P, PN>>;
}

function isInitializer<P extends Platform, PN extends ProtocolName>(
  ctr: ProtocolBuilder<P, PN>,
): ctr is ProtocolInitializer<P, PN> {
  return typeof ctr === "function" && "fromRpc" in ctr && typeof ctr.fromRpc === "function";
}

export type ProtocolInitializerFactory<P extends Platform, PN extends ProtocolName> = (
  ...args: any
) => ProtocolInitializer<P, PN>;

export type ProtocolBuilder<P extends Platform, PN extends ProtocolName> =
  | ProtocolInitializer<P, PN>
  | ProtocolInitializerFactory<P, PN>;

export type ProtocolFactoryMap<
  PN extends ProtocolName = ProtocolName,
  P extends Platform = Platform,
> = Map<PN, Map<P, ProtocolBuilder<P, PN>>>;
const protocolFactory: ProtocolFactoryMap = new Map();

export function registerProtocol<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
  ctr: ProtocolBuilder<P, PN>,
): void {
  let platforms = protocolFactory.get(protocol)!;

  if (!platforms) platforms = new Map<Platform, ProtocolBuilder<Platform, ProtocolName>>();

  if (platforms.has(platform)) return; //throw new Error(`Protocol ${platform} for protocol ${protocol} has already registered`);

  platforms.set(platform, ctr);
  protocolFactory.set(protocol, platforms);
}

export function protocolIsRegistered<T extends Platform | Chain, PN extends ProtocolName>(
  chainOrPlatform: T,
  protocol: PN,
): boolean {
  const platform: Platform = isChain(chainOrPlatform)
    ? chainToPlatform.get(chainOrPlatform)!
    : chainOrPlatform;

  const platforms = protocolFactory.get(protocol);
  return !!platforms && platforms.has(platform);
}

export function getProtocolBuilder<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
): ProtocolBuilder<P, PN> {
  const platforms = protocolFactory.get(protocol);
  if (platforms) {
    const pctr = platforms.get(platform);
    if (pctr) return pctr as ProtocolBuilder<P, PN>;
  }
  throw new Error(
    `No protocols registered for ${platform}:${protocol}. ` +
      `This may be because the platform specific protocol implementation is not registered (by installing and importing it)` +
      ` or no implementation exists for this platform`,
  );
}

export const create = <N extends Network, P extends Platform, PN extends ProtocolName, T>(
  platform: P,
  protocol: PN,
  rpc: RpcConnection<P>,
  config: ChainsConfig<N, P>,
  ...args: any
): Promise<T> => {
  const pctr = getProtocolBuilder(platform, protocol);
  if (isInitializer(pctr)) return pctr.fromRpc(rpc, config);
  return pctr(...args).fromRpc(rpc, config);
};
