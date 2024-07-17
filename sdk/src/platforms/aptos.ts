import * as _aptos from "@wormhole-foundation/sdk-aptos";
import type { PlatformDefinition } from "../index.js";
import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";

/** Platform and protocol definitions for Aptos */
const aptos: PlatformDefinition<typeof _aptos._platform> = {
  Address: _aptos.AptosAddress,
  Platform: _aptos.AptosPlatform,
  getSigner: _aptos.getAptosSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-aptos-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-aptos-tokenbridge"),
  },
  getChain: (network, chain, overrides?) =>
    new _aptos.AptosChain(
      chain,
      new _aptos.AptosPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _aptos._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};

export default aptos;
