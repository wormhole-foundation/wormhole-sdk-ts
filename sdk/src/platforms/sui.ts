import * as _sui from "@wormhole-foundation/sdk-sui";
import type { PlatformDefinition } from "../index.js";
/** Platform and protocol definitions for Sui */
const sui: PlatformDefinition<"Sui"> = {
  Address: _sui.SuiAddress,
  Platform: _sui.SuiPlatform,
  getSigner: _sui.getSuiSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-sui-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-sui-tokenbridge"),
  },
  getChain: (n, c) => new _sui.SuiChain(c, new _sui.SuiPlatform(n)),
};
export default sui;
