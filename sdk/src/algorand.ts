/// <reference path="../../platforms/algorand/dist/esm/address.d.ts" />
import type { Network, PlatformDefinition } from './index.js';
/** Platform and protocol definitions for Algorand */
export const algorand = async (): Promise<PlatformDefinition<Network, "Algorand">> => {
  const _algorand = await import("@wormhole-foundation/sdk-algorand");
  return {
    Address: _algorand.AlgorandAddress,
    ChainContext: _algorand.AlgorandChain,
    Platform: _algorand.AlgorandPlatform,
    Signer: _algorand.AlgorandSigner,
    getSigner: _algorand.getAlgorandSigner,
    protocols: {
      core: () => import("@wormhole-foundation/sdk-algorand-core"),
      tokenbridge: () => import("@wormhole-foundation/sdk-algorand-tokenbridge"),
    },
  };
};
