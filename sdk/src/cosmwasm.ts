/// <reference path="../../platforms/cosmwasm/src/index.ts" />
import * as _cosmwasm from "@wormhole-foundation/sdk-cosmwasm";
import type { PlatformDefinition } from "./index.js";
const cosmwasm: PlatformDefinition<"Cosmwasm"> = {
  Address: _cosmwasm.CosmwasmAddress,
  Platform: _cosmwasm.CosmwasmPlatform,
  getSigner: _cosmwasm.getCosmwasmSigner,
  protocolLoaders: {
    core: () => import("@wormhole-foundation/sdk-cosmwasm-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-cosmwasm-tokenbridge"),
    ibc: () => import("@wormhole-foundation/sdk-cosmwasm-ibc"),
  },
};
export default cosmwasm;
