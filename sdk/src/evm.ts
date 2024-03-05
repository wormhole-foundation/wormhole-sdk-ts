const _evm = await import("@wormhole-foundation/sdk-evm");
/** Platform and protocol definitions for Evm */
export const evm = {
  ...{
    Address: _evm.EvmAddress,
    ChainContext: _evm.EvmChain,
    Platform: _evm.EvmPlatform,
    Signer: _evm.EvmNativeSigner,
    getSigner: _evm.getEvmSignerForKey,
    getSignerForSigner: _evm.getEvmSignerForSigner,
  },
  protocols: {
    core: import("@wormhole-foundation/sdk-evm-core"),
    tokenbridge: import("@wormhole-foundation/sdk-evm-tokenbridge"),
    portico: import("@wormhole-foundation/sdk-evm-portico"),
    cctp: import("@wormhole-foundation/sdk-evm-cctp"),
  },
};
