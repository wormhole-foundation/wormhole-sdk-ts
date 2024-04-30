import * as _evm from "@wormhole-foundation/sdk-evm";
import type { PlatformDefinition } from "../index.js";

/** Platform and protocol definitions for Evm */
const evm: PlatformDefinition<"Evm"> = {
  Address: _evm.EvmAddress,
  Platform: _evm.EvmPlatform,
  getSigner: _evm.getEvmSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-evm-core"),
    TokenBridge: () => import("@wormhole-foundation/sdk-evm-tokenbridge"),
    PorticoBridge: () => import("@wormhole-foundation/sdk-evm-portico"),
    CircleBridge: () => import("@wormhole-foundation/sdk-evm-cctp"),
  },
};

export default evm;
