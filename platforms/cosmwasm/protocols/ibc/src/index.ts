import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmwasmIbcBridge } from "./ibc";

registerProtocol(_platform, "IbcBridge", CosmwasmIbcBridge);

export * from "./ibc";
