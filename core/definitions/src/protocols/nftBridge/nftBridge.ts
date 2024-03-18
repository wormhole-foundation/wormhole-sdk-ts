import type { Platform } from "@wormhole-foundation/sdk-base";
import type { EmptyPlatformMap } from "../../protocol.js";

import "../../registry.js";
declare module "../../registry.js" {
  export namespace WormholeRegistry {
    interface ProtocolToPlatformMapping {
      NftBridge: EmptyPlatformMap<Platform, "NftBridge">;
    }
  }
}
