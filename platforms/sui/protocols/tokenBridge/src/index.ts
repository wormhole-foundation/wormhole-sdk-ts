import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge.js";

registerProtocol("Sui", "TokenBridge", SuiTokenBridge);

export * from "./tokenBridge.js";
export * from "./utils.js";
