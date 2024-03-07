import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-cosmwasm";
import { CosmwasmWormholeCore } from "./core";

registerProtocol(_platform, "WormholeCore", CosmwasmWormholeCore);

export * from "./core";
