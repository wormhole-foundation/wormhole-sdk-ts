/// <reference path="../../platforms/sui/src/index.ts" />
import * as _sui from "@wormhole-foundation/sdk-sui";
import type { PlatformDefinition } from "./index.js";
/** Platform and protocol definitions for Sui */
const sui: PlatformDefinition<"Sui"> = {
  Address: _sui.SuiAddress,
  Platform: _sui.SuiPlatform,
  getSigner: _sui.getSuiSigner,
  protocolLoaders: {
    core: () => import("@wormhole-foundation/sdk-sui-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-sui-tokenbridge"),
  },
};
export default sui;
