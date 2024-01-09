import {
  Chain,
  Network,
  Platform,
  ProtocolName,
  chainToPlatform,
  isChain,
} from "@wormhole-foundation/sdk-base";
import { RpcConnection } from "./rpc";
import { ChainsConfig } from "./types";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {}
  }
}

type MappedProtocolPlatforms = keyof WormholeNamespace.PlatformToProtocolMapping;
type MappedProtocols = keyof WormholeNamespace.PlatformToProtocolMapping[MappedProtocolPlatforms];

export type ProtocolImplementation<
  T extends Platform,
  PN extends ProtocolName,
> = T extends MappedProtocolPlatforms
  ? PN extends MappedProtocols
    ? WormholeNamespace.PlatformToProtocolMapping[T][PN]
    : any
  : never;

export interface ProtocolInitializer<P extends Platform, PN extends ProtocolName> {
  fromRpc(
    rpc: RpcConnection<P>,
    config: ChainsConfig<Network, P>,
  ): Promise<ProtocolImplementation<P, PN>>;
}

const protocolFactory = new Map<
  Platform,
  Map<ProtocolName, ProtocolInitializer<Platform, ProtocolName>>
>();

export function registerProtocol<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
  ctr: ProtocolInitializer<P, PN>,
): void {
  let protocols = protocolFactory.get(platform)!;

  if (!protocols) protocols = new Map<ProtocolName, ProtocolInitializer<Platform, ProtocolName>>();

  if (protocols.has(protocol))
    throw new Error(`Protocol ${protocol} for platform ${platform} has already registered`);

  protocols.set(protocol, ctr);
  protocolFactory.set(platform, protocols);
}

export function protocolIsRegistered<T extends Platform | Chain, PN extends ProtocolName>(
  chainOrPlatform: T,
  protocol: PN,
): boolean {
  const platform: Platform = isChain(chainOrPlatform)
    ? chainToPlatform.get(chainOrPlatform)!
    : chainOrPlatform;

  const protocols = protocolFactory.get(platform);
  return !!protocols && protocols.has(protocol);
}

export function getProtocolInitializer<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
): ProtocolInitializer<P, PN> {
  const protocols = protocolFactory.get(platform);
  if (!protocols) throw new Error(`No protocols registered for platform ${platform}`);

  const pctr = protocols.get(protocol);
  if (!pctr) throw new Error(`No protocol registered for ${platform}:${protocol}`);

  return pctr;
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
