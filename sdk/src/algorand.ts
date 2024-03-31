/// <reference path="../../platforms/algorand/src/index.ts" />
import * as _algorand from "@wormhole-foundation/sdk-algorand";
import { PlatformDefinition } from "./index.js";

/** Platform and protocol definitions for Algorand */
const algorand: PlatformDefinition<"Algorand"> = {
  Address: _algorand.AlgorandAddress,
  Platform: _algorand.AlgorandPlatform,
  getSigner: _algorand.getAlgorandSigner,
  protocolLoaders: {
    core: () => import("@wormhole-foundation/sdk-algorand-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-algorand-tokenbridge"),
  },
};

export default algorand;
