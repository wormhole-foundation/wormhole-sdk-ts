import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import * as _evm from "@wormhole-foundation/sdk-evm";
import type { PlatformDefinition } from "../index.js";

/** Platform and protocol definitions for Evm */
const evm: PlatformDefinition<typeof _evm._platform> = {
  Address: _evm.EvmAddress,
  Platform: _evm.EvmPlatform,
  getSigner: _evm.getEvmSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-evm-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-evm-tokenbridge"),
    PorticoBridge: () => import("@wormhole-foundation/sdk-evm-portico"),
    CircleBridge: () => import("@wormhole-foundation/sdk-evm-cctp"),
  },
  getChain: (network, chain, overrides?) =>
    new _evm.EvmChain(
      chain,
      new _evm.EvmPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _evm._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};

export default evm;
