import { Platform } from "@wormhole-foundation/sdk-base";
import { EmptyPlatformMap } from "../../protocol";

declare global {
  namespace Wormhole {
    export interface ProtocolToPlatformMapping {
      NftBridge: EmptyPlatformMap<Platform, "NftBridge">;
    }
  }
}
