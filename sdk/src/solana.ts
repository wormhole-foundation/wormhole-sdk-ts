/// <reference path="../../platforms/solana/dist/esm/address.d.ts" />
import { Network, PlatformDefinition } from ".";
const module = import("@wormhole-foundation/sdk-solana");
/** Platform and protocol definitons for Solana */
export const solana = async (): Promise<PlatformDefinition<Network, "Solana">> => {
  const _solana = await module;
  return {
    Address: _solana.SolanaAddress,
    ChainContext: _solana.SolanaChain,
    Platform: _solana.SolanaPlatform,
    Signer: _solana.SolanaSigner,
    getSigner: _solana.getSolanaSignAndSendSigner,
    protocols: {
      core: () => import("@wormhole-foundation/sdk-solana-core"),
      tokenbridge: () => import("@wormhole-foundation/sdk-solana-tokenbridge"),
      cctp: () => import("@wormhole-foundation/sdk-solana-cctp"),
    },
  };
};
