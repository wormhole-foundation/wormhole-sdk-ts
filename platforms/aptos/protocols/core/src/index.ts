import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AptosWormholeCore } from "./core";

registerProtocol("Aptos", "WormholeCore", AptosWormholeCore);

export {AptosWormholeCore} from "./core";
