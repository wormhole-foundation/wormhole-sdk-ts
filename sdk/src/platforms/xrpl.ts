import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import { PlatformDefinition } from "../index.js";
import * as _xrpl from "@wormhole-foundation/sdk-xrpl";

export const xrpl: PlatformDefinition<typeof _xrpl._platform> = {
  Address: _xrpl.XrplAddress,
  Platform: _xrpl.XrplPlatform,
  getSigner: _xrpl.getXrplSigner,
  protocols: {},
  getChain: (network, chain, overrides?) =>
    new _xrpl.XrplChain(
      chain,
      new _xrpl.XrplPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _xrpl._platform, {
          [chain]: overrides,
        }),
      ),
    ),
};
export default xrpl;
