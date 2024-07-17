import type { Chain, Network } from "@wormhole-foundation/sdk-base";

import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      IbcReceiver: IbcReceiver<N, C>;
    }
    interface ProtocolToPlatformMapping {
      IbcReceiver: EmptyPlatformMap<"IbcReceiver">;
    }
  }
}

export interface IbcReceiver<N extends Network = Network, C extends Chain = Chain> {
}
