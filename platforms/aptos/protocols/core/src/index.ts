import { registerProtocol } from "@wormhole-foundation/connect-sdk";
import { AptosWormholeCore } from "./core";

registerProtocol("Aptos", "WormholeCore", AptosWormholeCore);

export * from "./core";
