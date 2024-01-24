import { _platform } from "@wormhole-foundation/connect-sdk-algorand";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AlgorandWormholeCore } from "./core";

registerProtocol(_platform, "WormholeCore", AlgorandWormholeCore);

export * from "./core";
export * from "./storage";
