import { PlatformDefinition } from ".";
import * as _algorand from "@wormhole-foundation/sdk-algorand";

/** Platform and protocol definitions for Algorand */
export const algorand: PlatformDefinition<"Algorand"> = {
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
