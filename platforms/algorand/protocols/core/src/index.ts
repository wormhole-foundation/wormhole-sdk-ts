import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AlgorandWormholeCore } from "./core";

registerProtocol("Algorand", "WormholeCore", AlgorandWormholeCore);

export * from "./core";
export * from "./storage";
