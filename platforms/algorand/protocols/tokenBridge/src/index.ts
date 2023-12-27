import { _platform } from "@wormhole-foundation/connect-sdk-algorand";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AlgorandTokenBridge } from "./tokenBridge";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Algorand: {};
    }
  }
}

registerProtocol(_platform, "TokenBridge", AlgorandTokenBridge);

export * from "./apps";
export * from "./assets";
export * from "./constants";
export * from "./tmplSig";
export * from "./tokenBridge";
export * from "./tokenBridge";
export * from "./transfers";
export * from "./types";
export * from "./utilities";
export * from "./_vaa";
