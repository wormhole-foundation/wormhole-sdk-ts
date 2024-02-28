import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosTokenBridge } from "./tokenBridge";

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export * from "./tokenBridge";
export * from "./types";
