import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge.js";
import { SuiExecutorTokenBridge } from "./executorTokenBridge.js";

registerProtocol("Sui", "TokenBridge", SuiTokenBridge);
registerProtocol("Sui", "ExecutorTokenBridge", SuiExecutorTokenBridge);

export * from "./tokenBridge.js";
export * from "./executorTokenBridge.js";
export * from "./utils.js";
