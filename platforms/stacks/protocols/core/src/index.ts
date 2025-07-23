import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { _platform } from "@wormhole-foundation/sdk-stacks"; // Using the proper package import
import { StacksWormholeCore } from "./core.js";

registerProtocol(_platform, 'WormholeCore', StacksWormholeCore);

export * from "./core.js";
