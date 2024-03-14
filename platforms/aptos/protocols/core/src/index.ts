import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosWormholeCore } from "./core.js";

registerProtocol("Aptos", "WormholeCore", AptosWormholeCore);

export { AptosWormholeCore } from "./core.js";
