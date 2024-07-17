import type { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import { chainToPlatform, isChain } from "@wormhole-foundation/sdk-base";
import type { Contracts } from "./contracts.js";
import type { WormholeRegistry } from "./registry.js";
import type { RpcConnection } from "./rpc.js";
import type { ChainsConfig } from "./types.js";

/**
 *  A string type representing the name of a protocol
 *  derived from the keys of the protocol registry map
 */
export type ProtocolName = keyof WormholeRegistry.ProtocolToInterfaceMapping;

/**
 * The interface corresponding to the protocol passed in generic parameters
 */
export type ProtocolInterface<
  PN extends ProtocolName,
  N extends Network,
  C extends Chain,
> = WormholeRegistry.ProtocolToInterfaceMapping<N, C>[PN];

export type EmptyPlatformMap<PN extends ProtocolName> = {
  [P in Platform]?: ProtocolInitializer<P, PN, Network, PlatformToChains<P>>;
};

type ProtocolImplementationMap = {
  [PN in ProtocolName]?: EmptyPlatformMap<PN>;
};

/** The platform specific implementation from the registry
 *  returns the ProtocolInitializer for constructing an instance
 *  of the Platform implementation
 */
export type ProtocolImplementation<
  P extends Platform,
  PN extends ProtocolName,
> = PN extends ProtocolName
  ? P extends keyof WormholeRegistry.ProtocolToPlatformMapping[PN]
    ? NonNullable<WormholeRegistry.ProtocolToPlatformMapping[PN][P]>
    : never
  : never;

/** The ProtocolInitializer provides a constructor or a static `fromRpc` method
 * to create an instance of the ProtocolInterface for a given network and chain
 */
export interface ProtocolInitializer<
  P extends Platform,
  PN extends ProtocolName,
  N extends Network,
  C extends PlatformToChains<P> = PlatformToChains<P>,
> {
  new (
    network: N,
    chain: C,
    connection: RpcConnection<P>,
    contracts: Contracts,
    version?: string,
  ): ProtocolInterface<PN, N, C>;
  /** fromRpc will create a new instance of the Protocol client given the RPC and the config
   * @param rpc - the RPC connection to the chain, used to query the chain for its native chain id
   * @param config - the ChainsConfig to use to initialize the protocol client
   */
  fromRpc(
    rpc: RpcConnection<P>,
    config: ChainsConfig<Network, P>,
  ): Promise<ProtocolInterface<PN, N, C>>;
}

export interface VersionedProtocolInitializer<
  P extends Platform,
  PN extends ProtocolName,
  N extends Network,
> extends ProtocolInitializer<P, PN, N> {
  getVersion(rpc: RpcConnection<P>, Contracts: Contracts): Promise<string>;
}

export function isVersionedProtocolInitializer(
  ctr: ProtocolInitializer<Platform, ProtocolName, Network>,
): ctr is VersionedProtocolInitializer<Platform, ProtocolName, Network> {
  return "getVersion" in ctr;
}

export type ProtocolInstance<
  P extends Platform,
  PN extends ProtocolName,
  N extends Network,
  C extends PlatformToChains<P> = PlatformToChains<P>,
> = InstanceType<ProtocolInitializer<P, PN, N, C>>;

// Runtime registry of protocol implementations from which we can initialize the
// protocol client
const protocolFactory: ProtocolImplementationMap = {};

/** registerProtocol sets the Platform specific implementation of a given Protocol interface  */
export function registerProtocol<
  P extends Platform,
  PN extends ProtocolName,
  PI extends ProtocolInitializer<P, PN, Network, PlatformToChains<P>> = ProtocolInitializer<
    P,
    PN,
    Network,
    PlatformToChains<P>
  >,
>(platform: P, protocol: PN, ctr: PI): void {
  if (!(protocol in protocolFactory)) protocolFactory[protocol] = {};

  const platforms = protocolFactory[protocol]!;
  if (platform in platforms)
    throw new Error(`Protocol ${platform} for protocol ${protocol} has already registered`);

  protocolFactory[protocol]![platform] = ctr;
}

export function protocolIsRegistered<T extends Platform | Chain, PN extends ProtocolName>(
  chainOrPlatform: T,
  protocol: PN,
): boolean {
  const platform: Platform = isChain(chainOrPlatform)
    ? chainToPlatform.get(chainOrPlatform)!
    : chainOrPlatform;
  if (!(protocol in protocolFactory)) return false;
  return platform in protocolFactory[protocol]!;
}

export function getProtocolInitializer<P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
): ProtocolInitializer<P, PN, Network, PlatformToChains<P>> {
  if (protocol in protocolFactory) {
    const platforms = protocolFactory[protocol]!;

    if (platforms && platform in platforms) {
      const pctr = platforms[platform];
      if (pctr) return pctr as ProtocolInitializer<P, PN, Network, PlatformToChains<P>>;
    }
  }
  throw new Error(
    `No protocols registered for ${platform}:${protocol}. ` +
      `This may be because the platform specific protocol implementation is not registered (by installing and importing it)` +
      ` or no implementation exists for this platform`,
  );
}

export const create = <N extends Network, P extends Platform, PN extends ProtocolName>(
  platform: P,
  protocol: PN,
  rpc: RpcConnection<P>,
  config: ChainsConfig<N, P>,
) => {
  const pctr = getProtocolInitializer(platform, protocol);
  return pctr.fromRpc(rpc, config);
};
