import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-cosmwasm";
import { CosmwasmTokenBridge } from "./tokenBridge.js";

registerProtocol(_platform, "TokenBridge", CosmwasmTokenBridge);

export * from "./tokenBridge.js";
