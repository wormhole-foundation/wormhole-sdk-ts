import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { CosmwasmWormholeCore } from "./wormholeCore";

registerProtocol("Cosmwasm", "WormholeCore", CosmwasmWormholeCore);

export * from "./wormholeCore";
