import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmWormholeCore } from "./wormholeCore";

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol("Cosmwasm", "WormholeCore", CosmwasmWormholeCore);

export * from "./wormholeCore";
