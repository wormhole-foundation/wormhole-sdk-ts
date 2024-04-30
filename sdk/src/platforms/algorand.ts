import * as _algorand from "@wormhole-foundation/sdk-algorand";
import { PlatformDefinition } from "../index.js";

/** Platform and protocol definitions for Algorand */
const algorand: PlatformDefinition<"Algorand"> = {
  Address: _algorand.AlgorandAddress,
  Platform: _algorand.AlgorandPlatform,
  getSigner: _algorand.getAlgorandSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-algorand-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-algorand-tokenbridge"),
  },
  getChain: (n, c) => new _algorand.AlgorandChain(c, new _algorand.AlgorandPlatform(n)),
};

export default algorand;
