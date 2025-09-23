import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import * as _hyperliquid from "@wormhole-foundation/sdk-hyperliquid";
import type { PlatformDefinition } from "../index.js";
/** Platform and protocol definitions for Hyperliquid */
const hyperliquid: PlatformDefinition<typeof _hyperliquid._platform> = {
  Address: _hyperliquid.HyperliquidAddress,
  Platform: _hyperliquid.HyperliquidPlatform,
  getSigner: _hyperliquid.getHyperliquidSigner,
  protocols: {},
  getChain: (network, chain, overrides?) =>
    new _hyperliquid.HyperliquidChain(
      chain,
      new _hyperliquid.HyperliquidPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _hyperliquid._platform, { [chain]: overrides }),
      ),
    ),
};
export default hyperliquid;
