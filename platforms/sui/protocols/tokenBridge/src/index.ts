import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge.js";
import { SuiAutomaticTokenBridge } from "./automaticTokenBridge.js";

registerProtocol("Sui", "TokenBridge", SuiTokenBridge);
registerProtocol("Sui", "AutomaticTokenBridge", SuiAutomaticTokenBridge);

export * from "./tokenBridge.js";
export * from "./automaticTokenBridge.js";
export * from "./utils.js";
