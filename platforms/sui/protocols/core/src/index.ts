import { _platform } from "@wormhole-foundation/sdk-sui";
import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { SuiWormholeCore } from "./core";

registerProtocol(_platform, "WormholeCore", SuiWormholeCore);

export * from "./core";
