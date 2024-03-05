const _aptos = await import("@wormhole-foundation/sdk-aptos");

/** Platform and protocol definitions for Aptos */
export const aptos = {
  ...{
    Address: _aptos.AptosAddress,
    ChainContext: _aptos.AptosChain,
    Platform: _aptos.AptosPlatform,
    Signer: _aptos.AptosSigner,
    getSigner: _aptos.getAptosSigner,
  },
  protocols: {
    core: import("@wormhole-foundation/sdk-aptos-core"),
    tokenbridge: import("@wormhole-foundation/sdk-aptos-tokenbridge"),
  },
};
