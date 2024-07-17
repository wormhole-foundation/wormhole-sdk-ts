import type { Chain, Network } from "@wormhole-foundation/sdk-base";

import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      WormchainGovernance: WormchainGovernance<N, C>;
    }
    interface ProtocolToPlatformMapping {
      WormchainGovernance: EmptyPlatformMap<"WormchainGovernance">;
    }
  }
}

export interface WormchainGovernance<N extends Network = Network, C extends Chain = Chain> {
}
