// EXAMPLE_SYNC_IMPORT
import { Wormhole } from "@wormhole-foundation/sdk";
import evm from "../../sdk/dist/esm/platforms/evm.js";

const wh = new Wormhole("Mainnet", [evm.Platform]);
console.log(wh.config);
// EXAMPLE_SYNC_IMPORT
