import { Chain, Network } from "@wormhole-foundation/sdk-base";

// Acts as a registry for all the dynamically loaded platforms or protocols
export namespace WormholeRegistry {
  export interface PlatformToNativeAddressMapping {}
  /** Map of ProtocolName to ProtocolInterface */
  export interface ProtocolToInterfaceMapping<
    N extends Network = Network,
    C extends Chain = Chain,
  > {}
  export interface ProtocolToPlatformMapping {}
  export interface PayloadLiteralToLayoutMapping {}
}
