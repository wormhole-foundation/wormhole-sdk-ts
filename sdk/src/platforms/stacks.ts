import { applyChainsConfigConfigOverrides } from "@wormhole-foundation/sdk-connect";
import { PlatformDefinition } from "../index.js";
import * as _stacks from "@wormhole-foundation/sdk-stacks";

export const stacks: PlatformDefinition<typeof _stacks._platform> = {
  Address: _stacks.StacksAddress,
  Platform: _stacks.StacksPlatform,
  getSigner: _stacks.getStacksSigner,
  protocols: {
    WormholeCore: () => import("@wormhole-foundation/sdk-stacks-core"),
  },
  getChain: (network, chain, overrides?) =>
    new _stacks.StacksChain(
      chain,
      new _stacks.StacksPlatform(
        network,
        applyChainsConfigConfigOverrides(network, _stacks._platform, {
          [chain]: overrides,
        }),
      ),
    ),
}
export default stacks;
