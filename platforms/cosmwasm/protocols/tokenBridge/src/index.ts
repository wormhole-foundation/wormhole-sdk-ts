import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-cosmwasm";
import { CosmwasmTokenBridge } from "./tokenBridge";

registerProtocol(_platform, "TokenBridge", CosmwasmTokenBridge);

export { CosmwasmTokenBridge } from "./tokenBridge";
