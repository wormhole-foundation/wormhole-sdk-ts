import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmIbcBridge } from "./ibc";

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol("Cosmwasm", "IbcBridge", CosmwasmIbcBridge);

export * from "./ibc";
