import * as _solana from "@wormhole-foundation/sdk-solana";
import * as _solana_core from "@wormhole-foundation/sdk-solana-core";
import * as _solana_tokenbridge from "@wormhole-foundation/sdk-solana-tokenbridge";
import * as _solana_cctp from "@wormhole-foundation/sdk-solana-cctp";
/** Platform and protocol definitons for Solana */
export const solana = {
  ...{
    Address: _solana.SolanaAddress,
    ChainContext: _solana.SolanaChain,
    Platform: _solana.SolanaPlatform,
    Signer: _solana.SolanaSigner,
    getSigner: _solana.getSolanaSigner,
  },
  protocols: {
    core: _solana_core,
    tokenbridge: _solana_tokenbridge,
    cctp: _solana_cctp,
  },
};
