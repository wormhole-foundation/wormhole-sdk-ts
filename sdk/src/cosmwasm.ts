import * as _cosmwasm from "@wormhole-foundation/sdk-cosmwasm";
import * as _cosmwasm_core from "@wormhole-foundation/sdk-cosmwasm-core";
import * as _cosmwasm_tokenbridge from "@wormhole-foundation/sdk-cosmwasm-tokenbridge";
import * as _cosmwasm_ibc from "@wormhole-foundation/sdk-cosmwasm-ibc";

/** Platform and protocol definitions for Cosmwasm */
export const cosmwasm = {
  ..._cosmwasm,
  ...{
    Address: _cosmwasm.CosmwasmAddress,
    ChainContext: _cosmwasm.CosmwasmChain,
    Platform: _cosmwasm.CosmwasmPlatform,
    Signer: _cosmwasm.CosmwasmSigner,
  },
  protocols: {
    core: _cosmwasm_core,
    tokenbridge: _cosmwasm_tokenbridge,
    ibc: _cosmwasm_ibc,
  },
};
