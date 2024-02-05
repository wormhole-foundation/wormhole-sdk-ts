import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-algorand";
import { AlgorandTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", AlgorandTokenBridge);

export * from "./tokenBridge";
