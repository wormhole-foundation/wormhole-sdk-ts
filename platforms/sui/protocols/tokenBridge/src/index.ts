import { _platform } from "@wormhole-foundation/connect-sdk-sui";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { SuiTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", SuiTokenBridge);

export * from "./tokenBridge";
export * from "./utils";
