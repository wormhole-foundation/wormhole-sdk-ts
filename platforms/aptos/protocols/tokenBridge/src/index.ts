import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosTokenBridge } from "./tokenBridge";

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export { AptosTokenBridge } from "./tokenBridge";
export type { TokenBridgeState, OriginInfo, CreateTokenDataEvent, DepositEvent } from "./types";
