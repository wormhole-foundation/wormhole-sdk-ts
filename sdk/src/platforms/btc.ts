import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import type { PlatformDefinition } from "../index.js";
import * as _btc from "@wormhole-foundation/sdk-btc"; 

export const btc: PlatformDefinition<typeof _btc._platform> = {
  Address: _btc.BtcAddress,
  Platform: _btc.BtcPlatform,
  getSigner: _btc.getBtcSigner,
  protocols: {},
  getChain: (network, chain, overrides?) =>
    new _btc.BtcChain(
      chain,
      new _btc.BtcPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _btc._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};
export default btc;
