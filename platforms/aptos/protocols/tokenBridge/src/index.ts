import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AptosTokenBridge } from "./tokenBridge";
registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export * from "./tokenBridge";
export * from "./types";
