import * as _solana from "@wormhole-foundation/sdk-solana";
/** Platform and protocol definitons for Solana */
export const solana = {
  ...{
    Address: _solana.SolanaAddress,
    ChainContext: _solana.SolanaChain,
    Platform: _solana.SolanaPlatform,
    Signer: _solana.SolanaSigner,
    getSigner: _solana.getSolanaSignAndSendSigner,
  },
  protocols: {
    core: import("@wormhole-foundation/sdk-solana-core"),
    tokenbridge: import("@wormhole-foundation/sdk-solana-tokenbridge"),
    cctp: import("@wormhole-foundation/sdk-solana-cctp"),
  },
};
