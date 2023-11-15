import { _platform } from "@wormhole-foundation/connect-sdk-sui";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { SuiWormholeCore } from "./core";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Sui: {};
    }
  }
}

registerProtocol(_platform, "WormholeCore", SuiWormholeCore);

export * from "./core";
