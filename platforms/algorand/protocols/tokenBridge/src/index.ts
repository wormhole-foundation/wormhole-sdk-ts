import { _platform } from "@wormhole-foundation/connect-sdk-algorand";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AlgorandTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", AlgorandTokenBridge);

export * from "./tokenBridge";
