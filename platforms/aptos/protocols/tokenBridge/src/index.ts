import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosTokenBridge } from "./tokenBridge";

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export {AptosTokenBridge} from "./tokenBridge";
export {TokenBridgeState, OriginInfo, CreateTokenDataEvent, DepositEvent} from "./types";
