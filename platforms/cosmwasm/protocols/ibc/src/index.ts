import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmIbcBridge } from "./ibc";

registerProtocol("Cosmwasm", "IbcBridge", CosmwasmIbcBridge);

export * from "./ibc";
