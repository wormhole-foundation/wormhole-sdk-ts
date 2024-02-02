import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AlgorandWormholeCore } from "./core";

registerProtocol("Algorand", "WormholeCore", AlgorandWormholeCore);

export * from "./core";
export * from "./storage";
