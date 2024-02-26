import * as _solana from "@wormhole-foundation/connect-sdk-solana";
import * as _solana_core from "@wormhole-foundation/connect-sdk-solana-core";
import * as _solana_tokenbridge from "@wormhole-foundation/connect-sdk-solana-tokenbridge";
import * as _solana_cctp from "@wormhole-foundation/connect-sdk-solana-cctp";
export const solana = {
  ...{
    Address: _solana.SolanaAddress,
    ChainContext: _solana.SolanaChain,
    Platform: _solana.SolanaPlatform,
    Signer: _solana.SolanaSigner,
  },
  protocols: {
    core: _solana_core,
    tokenbridge: _solana_tokenbridge,
    cctp: _solana_cctp,
  },
};
