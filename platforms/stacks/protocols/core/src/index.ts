import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-stacks";
import { StacksWormholeCore } from "./core.js";

registerProtocol(_platform, 'WormholeCore', StacksWormholeCore);

export * from "./core.js";
