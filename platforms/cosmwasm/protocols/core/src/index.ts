import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmwasmWormholeCore } from "./wormholeCore";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol(_platform, "WormholeCore", CosmwasmWormholeCore);

export * from "./wormholeCore";
