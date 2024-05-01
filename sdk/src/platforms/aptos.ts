import * as _aptos from "@wormhole-foundation/sdk-aptos";
import { PlatformDefinition } from "../index.js";

/** Platform and protocol definitions for Aptos */
const aptos: PlatformDefinition<"Aptos"> = {
  Address: _aptos.AptosAddress,
  Platform: _aptos.AptosPlatform,
  getSigner: _aptos.getAptosSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-aptos-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-aptos-tokenbridge"),
  },
  getChain: (n, c) => new _aptos.AptosChain(c, new _aptos.AptosPlatform(n)),
};

export default aptos;
