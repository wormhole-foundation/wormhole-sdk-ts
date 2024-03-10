import { Network, PlatformDefinition } from ".";
import * as _cosmwasm from "@wormhole-foundation/sdk-cosmwasm";
/** Platform and protocol definitions for Cosmwasm */
export const cosmwasm: PlatformDefinition<Network, "Cosmwasm"> = {
  Address: _cosmwasm.CosmwasmAddress,
  ChainContext: _cosmwasm.CosmwasmChain,
  Platform: _cosmwasm.CosmwasmPlatform,
  Signer: _cosmwasm.CosmwasmSigner,
  getSigner: _cosmwasm.getCosmwasmSigner,
  protocols: {
    core: () => import("@wormhole-foundation/sdk-cosmwasm-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-cosmwasm-tokenbridge"),
    ibc: () => import("@wormhole-foundation/sdk-cosmwasm-ibc"),
  },
};
