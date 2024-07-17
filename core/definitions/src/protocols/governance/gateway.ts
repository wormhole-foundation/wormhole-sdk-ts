import type { Chain, Network } from "@wormhole-foundation/sdk-base";

import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      GatewayGovernance: GatewayGovernance<N, C>;
    }
    interface ProtocolToPlatformMapping {
      GatewayGovernance: EmptyPlatformMap<"GatewayGovernance">;
    }
  }
}

export interface GatewayGovernance<N extends Network = Network, C extends Chain = Chain> {
}
