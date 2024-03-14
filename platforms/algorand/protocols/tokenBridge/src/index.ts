import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-algorand";
import { AlgorandTokenBridge } from './tokenBridge.js';

registerProtocol(_platform, "TokenBridge", AlgorandTokenBridge);

export {TransferMethodSelector, AlgorandTokenBridge} from './tokenBridge.js';
