import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmTokenBridge } from "./tokenBridge";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol("Cosmwasm", "TokenBridge", CosmwasmTokenBridge);

export * from "./tokenBridge";
