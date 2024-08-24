import type { Chain, Network } from "@wormhole-foundation/sdk-base";

/**
 * WormholeRegistry is a namespace to provide consumers and downstream packages
 * a way to include their own custom implementations of protocols or native address parsers.
 */
export namespace WormholeRegistry {
  /** Map of platform to native address parser */
  export interface PlatformToNativeAddressMapping {}
  /** Map of ProtocolName to ProtocolInterface */
  export interface ProtocolToInterfaceMapping<
    N extends Network = Network,
    C extends Chain = Chain,
  > {}
  /** Map of ProtocolName to Platform specific implementation */
  export interface ProtocolToPlatformMapping {}
  /** Map of PayloadLiteral name to its Layout */
  export interface PayloadLiteralToLayoutMapping {}
}
