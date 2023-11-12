import { Chain, Network, Platform, PlatformToChains } from "@wormhole-foundation/sdk-base";
import { ChainContext, PlatformContext } from "../..";

export function chainFactory<N extends Network, P extends Platform, C extends PlatformToChains<P>>(
  p: PlatformContext<N, P>,
  chain: C,
): ChainContext<N, P, C> {
  return p.getChain(chain);
}

export class MockChain<
  N extends Network,
  P extends Platform,
  C extends Chain = PlatformToChains<P>,
> extends ChainContext<N, P, C> {
  constructor(chain: C, platform: PlatformContext<N, P>) {
    super(chain, platform);
  }
}
