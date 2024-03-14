import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosTokenBridge } from './tokenBridge.js';

registerProtocol("Aptos", "TokenBridge", AptosTokenBridge);

export {AptosTokenBridge} from './tokenBridge.js';
export {TokenBridgeState, OriginInfo, CreateTokenDataEvent, DepositEvent} from './types.js';
