import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", SuiTokenBridge);

export * from "./tokenBridge";
export * from "./utils";
