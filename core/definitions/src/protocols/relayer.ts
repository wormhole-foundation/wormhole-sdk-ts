import { Platform } from "@wormhole-foundation/sdk-base";
import { EmptyPlatformMap } from "../protocol";

declare global {
  namespace WormholeNamespace {
    export interface ProtocolToPlatformMapping {
      Relayer: EmptyPlatformMap<Platform, "Relayer">;
    }
  }
}
