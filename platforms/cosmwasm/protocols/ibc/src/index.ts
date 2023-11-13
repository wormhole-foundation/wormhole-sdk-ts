import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmIbcBridge } from "./ibc";

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Cosmwasm: {};
    }
  }
}

registerProtocol("Cosmwasm", "IbcBridge", CosmwasmIbcBridge);

export * from "./ibc";
