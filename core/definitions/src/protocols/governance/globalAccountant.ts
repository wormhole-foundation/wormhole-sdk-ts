import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      GlobalAccountant: GlobalAccountant<N, C>;
    }
    interface ProtocolToPlatformMapping {
      GlobalAccountant: EmptyPlatformMap<"GlobalAccountant">;
    }
  }
}

export const modificationKinds = [
  [ "Add", 1 ],
  [ "Subtract", 2 ],
  [ "Unknown", 3 ],
] as const;

export interface GlobalAccountant<N extends Network = Network, C extends Chain = Chain> {
}
