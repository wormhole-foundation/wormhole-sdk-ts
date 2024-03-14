import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge.js";

registerProtocol(_platform, "TokenBridge", SuiTokenBridge);

export { SuiTokenBridge } from "./tokenBridge.js";
export { getTokenFromTokenRegistry, getTokenCoinType } from "./utils.js";
