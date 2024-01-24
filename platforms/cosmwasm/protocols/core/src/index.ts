import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { _platform } from "@wormhole-foundation/connect-sdk-cosmwasm";
import { CosmwasmWormholeCore } from "./core";

registerProtocol(_platform, "WormholeCore", CosmwasmWormholeCore);

export * from "./core";
