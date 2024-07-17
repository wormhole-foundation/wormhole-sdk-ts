import * as _algorand from "@wormhole-foundation/sdk-algorand";
import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import type { PlatformDefinition } from "../index.js";

/** Platform and protocol definitions for Algorand */
const algorand: PlatformDefinition<typeof _algorand._platform> = {
  Address: _algorand.AlgorandAddress,
  Platform: _algorand.AlgorandPlatform,
  getSigner: _algorand.getAlgorandSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-algorand-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-algorand-tokenbridge"),
  },
  getChain: (network, chain, overrides?) =>
    new _algorand.AlgorandChain(
      chain,
      new _algorand.AlgorandPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _algorand._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};

export default algorand;
