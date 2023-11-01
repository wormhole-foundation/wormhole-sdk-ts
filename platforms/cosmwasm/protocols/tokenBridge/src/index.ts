import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmTokenBridge } from "./tokenBridge";

registerProtocol("Cosmwasm", "TokenBridge", CosmwasmTokenBridge);

export * from "./tokenBridge";
