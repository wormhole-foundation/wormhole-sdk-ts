import { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import { ChainToPlatform } from "@wormhole-foundation/sdk-base/src";
import { ChainContext, PlatformContext } from "../..";

export function chainFactory<N extends Network, P extends Platform, C extends PlatformToChains<P>>(
  p: PlatformContext<N, P>,
  chain: C,
): ChainContext<N, C> {
  return p.getChain(chain);
}

export class MockChain<N extends Network, C extends Chain = Chain> extends ChainContext<N, C> {
  constructor(chain: C, platform: PlatformContext<N, ChainToPlatform<C>>) {
    super(chain, platform);
  }
}
