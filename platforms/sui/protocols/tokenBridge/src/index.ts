import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", SuiTokenBridge);

export { SuiTokenBridge } from "./tokenBridge";
export { getTokenFromTokenRegistry, getTokenCoinType } from "./utils";
