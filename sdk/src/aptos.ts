import * as _aptos from "@wormhole-foundation/sdk-aptos";
import * as _aptos_core from "@wormhole-foundation/sdk-aptos-core";
import * as _aptos_tokenbridge from "@wormhole-foundation/sdk-aptos-tokenbridge";

export const aptos = {
  ...{
    Address: _aptos.AptosAddress,
    ChainContext: _aptos.AptosChain,
    Platform: _aptos.AptosPlatform,
    Signer: _aptos.AptosSigner,
  },
  protocols: {
    core: _aptos_core,
    tokenbridge: _aptos_tokenbridge,
  },
};
