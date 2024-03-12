import type { Platform } from "@wormhole-foundation/sdk-base";
import type { EmptyPlatformMap } from "../../protocol";

import "../../registry";
declare module "../../registry" {
  export namespace WormholeRegistry {
    interface ProtocolToPlatformMapping {
      NftBridge: EmptyPlatformMap<Platform, "NftBridge">;
    }
  }
}
