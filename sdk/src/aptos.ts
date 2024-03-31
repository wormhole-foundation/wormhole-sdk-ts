/// <reference path="../../platforms/aptos/src/index.ts" />
import * as _aptos from "@wormhole-foundation/sdk-aptos";
import { PlatformDefinition } from "./index.js";

/** Platform and protocol definitions for Aptos */
const aptos: PlatformDefinition<"Aptos"> = {
  Address: _aptos.AptosAddress,
  Platform: _aptos.AptosPlatform,
  getSigner: _aptos.getAptosSigner,
  protocolLoaders: {
    core: () => import("@wormhole-foundation/sdk-aptos-core"),
    tokenbridge: () => import("@wormhole-foundation/sdk-aptos-tokenbridge"),
  },
};

export default aptos;
