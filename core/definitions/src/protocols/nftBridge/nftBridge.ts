import type { EmptyPlatformMap } from "../../protocol.js";
import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToInterfaceMapping<N, C> {
      NftBridge: any;
    }
    interface ProtocolToPlatformMapping {
      NftBridge: EmptyPlatformMap<"NftBridge">;
    }
  }
}
