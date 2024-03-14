/// <reference path="../../platforms/cosmwasm/dist/esm/address.d.ts" />
import type { Network, PlatformDefinition } from './index.js';
/** Platform and protocol definitions for Cosmwasm */
export const cosmwasm = async (): Promise<PlatformDefinition<Network, "Cosmwasm">> => {
  const _cosmwasm = await import("@wormhole-foundation/sdk-cosmwasm");
  return {
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
};
