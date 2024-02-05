import { Chain, Network, Platform, chainToPlatform, isChain } from "@wormhole-foundation/sdk-base";
import { RpcConnection } from "./rpc";
import { ChainsConfig } from "./types";

declare global {
  namespace Wormhole {
    export interface ProtocolToPlatformMapping {}
  }
}

/** A string type representing the name of a protocol */
export type ProtocolName = keyof Wormhole.ProtocolToPlatformMapping;
type MappedProtocolPlatforms = keyof Wormhole.ProtocolToPlatformMapping[ProtocolName];

export type EmptyPlatformMap<P extends Platform, PN extends ProtocolName> = Map<
  P,
  ProtocolInitializer<P, PN>
>;

export type ProtocolImplementation<
  T extends Platform,
  PN extends ProtocolName,
> = PN extends ProtocolName
  ? T extends MappedProtocolPlatforms
    ? Wormhole.ProtocolToPlatformMapping[PN][T]
    : any
  : never;

export interface ProtocolInitializer<P extends Platform, PN extends ProtocolName> {
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

export function registerProtocol<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
  ctr: ProtocolInitializer<P, PN>,
): void {
  let platforms = protocolFactory.get(protocol)!;

  if (!platforms) platforms = new Map<Platform, ProtocolInitializer<Platform, ProtocolName>>();

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
