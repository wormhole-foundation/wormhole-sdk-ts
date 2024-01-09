import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AptosTokenBridge } from "./tokenBridge";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Aptos: {};
    }
  }
}

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export * from "./tokenBridge";
export * from "./types";
