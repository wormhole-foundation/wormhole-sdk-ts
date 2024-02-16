import { _platform } from "@wormhole-foundation/connect-sdk-sui";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { SuiTokenBridge } from "./tokenBridge";

import "@wormhole-foundation/connect-sdk-sui-core";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Sui: {};
    }
  }
}

registerProtocol(_platform, "TokenBridge", SuiTokenBridge);

export * from "./tokenBridge";
export * from "./utils";
