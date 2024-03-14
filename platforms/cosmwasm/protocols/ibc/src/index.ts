import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-cosmwasm";
import { CosmwasmIbcBridge } from "./ibc.js";

registerProtocol(_platform, "IbcBridge", CosmwasmIbcBridge);

export { CosmwasmIbcBridge } from "./ibc.js";
