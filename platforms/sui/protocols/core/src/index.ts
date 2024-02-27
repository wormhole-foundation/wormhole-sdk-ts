import { _platform } from "@wormhole-foundation/connect-sdk-sui";
import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { SuiWormholeCore } from "./core";

registerProtocol(_platform, "WormholeCore", SuiWormholeCore);

export * from "./core";
