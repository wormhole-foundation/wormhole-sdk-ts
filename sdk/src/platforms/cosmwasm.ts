import * as _cosmwasm from "@wormhole-foundation/sdk-cosmwasm";
import type { PlatformDefinition } from "../index.js";
const cosmwasm: PlatformDefinition<"Cosmwasm"> = {
  Address: _cosmwasm.CosmwasmAddress,
  Platform: _cosmwasm.CosmwasmPlatform,
  getSigner: _cosmwasm.getCosmwasmSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-cosmwasm-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-cosmwasm-tokenbridge"),
    IbcBridge: () => import("@wormhole-foundation/sdk-cosmwasm-ibc"),
  },
};
export default cosmwasm;
