import type { Chain, Network } from "@wormhole-foundation/sdk-base";

import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      GeneralPurposeGovernance: GeneralPurposeGovernance<N, C>;
    }
    interface ProtocolToPlatformMapping {
      GeneralPurposeGovernance: EmptyPlatformMap<"GeneralPurposeGovernance">;
    }
  }
}

export interface GeneralPurposeGovernance<N extends Network = Network, C extends Chain = Chain> {
}
