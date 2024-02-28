import * as _evm from "@wormhole-foundation/sdk-evm";
import * as _evm_core from "@wormhole-foundation/sdk-evm-core";
import * as _evm_tokenbridge from "@wormhole-foundation/sdk-evm-tokenbridge";
import * as _evm_portico from "@wormhole-foundation/sdk-evm-portico";
import * as _evm_cctp from "@wormhole-foundation/sdk-evm-cctp";
export const evm = {
  ...{
    getEvmSignerForKey: _evm.getEvmSignerForKey,
    getEvmSignerForSigner: _evm.getEvmSignerForSigner,
  },
  ...{
    Address: _evm.EvmAddress,
    ChainContext: _evm.EvmChain,
    Platform: _evm.EvmPlatform,
    Signer: _evm.EvmNativeSigner,
  },
  protocols: {
    core: _evm_core,
    tokenbridge: _evm_tokenbridge,
    portico: _evm_portico,
    cctp: _evm_cctp,
  },
};
