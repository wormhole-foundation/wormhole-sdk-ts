import type { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import { chainToPlatform, isChain } from "@wormhole-foundation/sdk-base";
import type { WormholeRegistry } from "./registry.js";
import type { RpcConnection } from "./rpc.js";
import type { ChainsConfig } from "./types.js";

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
  new (
    network: Network,
    chain: PlatformToChains<P>,
    connection: RpcConnection<P>,
    contracts: any,
  ): ProtocolImplementation<P, PN>;
  fromRpc(
    rpc: RpcConnection<P>,
    config: ChainsConfig<Network, P>,
  ): Promise<ProtocolImplementation<P, PN>>;
}

export type ProtocolFactoryMap<
  PN extends ProtocolName = ProtocolName,
  P extends Platform = Platform,
> = Map<PN, Map<P, ProtocolInitializer<P, PN>>>;
const protocolFactory: ProtocolFactoryMap = new Map();

export function registerProtocol<
  P extends Platform,
  PN extends ProtocolName,
  PI extends ProtocolInitializer<P, PN>,
>(platform: P, protocol: PN, ctr: PI): void {
  let platforms = protocolFactory.get(protocol)!;

  if (!platforms) platforms = new Map<P, ProtocolInitializer<P, ProtocolName>>();

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

export function getProtocolInitializer<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
): ProtocolInitializer<P, PN> {
  const platforms = protocolFactory.get(protocol);
  if (platforms) {
    const pctr = platforms.get(platform);
    if (pctr) return pctr as ProtocolInitializer<P, PN>;
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
): Promise<T> => {
  const pctr = getProtocolInitializer(platform, protocol);
  return pctr.fromRpc(rpc, config);
};
