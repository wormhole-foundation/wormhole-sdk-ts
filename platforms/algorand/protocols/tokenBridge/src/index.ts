import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-algorand";
import { AlgorandTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", AlgorandTokenBridge);

export * from "./tokenBridge";
