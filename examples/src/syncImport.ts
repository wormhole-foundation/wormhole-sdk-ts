// EXAMPLE_SYNC_IMPORT
import { Wormhole } from "@wormhole-foundation/sdk";
import evm from "@wormhole-foundation/sdk/evm";

const wh = new Wormhole("Mainnet", [evm.Platform]);
console.log(wh.config);
// EXAMPLE_SYNC_IMPORT
