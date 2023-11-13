import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AptosWormholeCore } from "./core";

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Aptos: {};
    }
  }
}

registerProtocol("Aptos", "WormholeCore", AptosWormholeCore);

export * from "./core";
