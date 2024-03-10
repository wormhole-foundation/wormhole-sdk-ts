import { Network, PlatformDefinition } from ".";
/** Platform and protocol definitions for Sui */
export const sui = async (): Promise<PlatformDefinition<Network, "Sui">> => {
  const _sui = await import("@wormhole-foundation/sdk-sui");
  return {
    Address: _sui.SuiAddress,
    ChainContext: _sui.SuiChain,
    Platform: _sui.SuiPlatform,
    Signer: _sui.SuiSigner,
    getSigner: _sui.getSuiSigner,
    protocols: {
      core: () => import("@wormhole-foundation/sdk-sui-core"),
      tokenbridge: () => import("@wormhole-foundation/sdk-sui-tokenbridge"),
    },
  };
};
