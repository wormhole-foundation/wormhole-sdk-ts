import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmwasmTokenBridge } from "./tokenBridge";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol(_platform, "TokenBridge", CosmwasmTokenBridge);

export * from "./tokenBridge";
