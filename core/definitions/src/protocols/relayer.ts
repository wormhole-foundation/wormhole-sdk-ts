import { Platform } from "@wormhole-foundation/sdk-base";
import { EmptyPlatformMap, registerProtocolName } from "../protocol";

declare global {
  namespace WormholeNamespace {
    export interface ProtocolToPlatformMapping {
      Relayer: EmptyPlatformMap<Platform, "Relayer">;
    }
  }
}
registerProtocolName("Relayer");
