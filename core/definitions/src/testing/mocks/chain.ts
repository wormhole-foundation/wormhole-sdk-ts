import {
  Chain,
  Network,
  Platform,
  PlatformToChains
} from "@wormhole-foundation/sdk-base";
import { ChainConfig, ChainContext, PlatformContext } from "../..";
import { mockPlatformFactory } from "./platform";

export function chainFactory<N extends Network, P extends Platform>(
  p: PlatformContext<N, P>,
  chain: PlatformToChains<P>,
): ChainContext<N, PlatformToChains<P>, P> {
  return p.getChain(chain);
}

export class MockChain<N extends Network, C extends Chain, P extends Platform> extends ChainContext<N, C, P> {
  readonly platform: PlatformContext<N, P>;
  constructor(config: ChainConfig<N, C>) {
    super(config);
    this.platform = mockPlatformFactory<N, P>(
      config.network,
      // @ts-ignore
      config.platform as P,
      {},
    );
  }
}
