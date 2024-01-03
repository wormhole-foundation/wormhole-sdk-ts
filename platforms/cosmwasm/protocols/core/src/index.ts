import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmwasmWormholeCore } from "./core";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol(_platform, "WormholeCore", CosmwasmWormholeCore);

export * from "./core";
