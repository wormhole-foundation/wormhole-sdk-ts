import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosWormholeCore } from "./core.js";

registerProtocol("Aptos", "WormholeCore", AptosWormholeCore);

export * from "./core.js";
