import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AlgorandWormholeCore } from "./core.js";

registerProtocol("Algorand", "WormholeCore", AlgorandWormholeCore);

export * from "./core.js";
export * from "./storage.js";
