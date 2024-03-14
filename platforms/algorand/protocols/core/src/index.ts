import { registerProtocol } from "@wormhole-foundation/sdk-connect";
import { AlgorandWormholeCore } from "./core";

registerProtocol("Algorand", "WormholeCore", AlgorandWormholeCore);

export {AlgorandWormholeCore} from "./core";
export {SEED_AMT, MAX_KEYS, MAX_BYTES_PER_KEY, BITS_PER_BYTE, BITS_PER_KEY, MAX_BYTES, MAX_BITS, PopulateData, varint, StorageLogicSig} from "./storage";
