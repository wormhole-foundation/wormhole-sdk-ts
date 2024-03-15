import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosTokenBridge } from "./tokenBridge.js";

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export * from "./tokenBridge.js";
export type { TokenBridgeState, OriginInfo, CreateTokenDataEvent, DepositEvent } from "./types.js";
