import {
  Chain,
  ChainToPlatform,
  Network,
  Platform,
  PlatformToChains,
} from "@wormhole-foundation/sdk-base";
import { ChainConfig, ChainContext, PlatformUtils } from "../..";
import { mockPlatformFactory } from "./platform";

export function chainFactory<N extends Network, P extends Platform>(
  p: PlatformUtils<N, P>,
  chain: PlatformToChains<P>,
): ChainContext<N, PlatformToChains<P>> {
  return p.getChain(chain);
}

export class MockChain<N extends Network, C extends Chain> extends ChainContext<N, C> {
  readonly platform: PlatformUtils<N, ChainToPlatform<C>>;
  constructor(config: ChainConfig<N, C>) {
    super(config);
    this.platform = mockPlatformFactory<N, ChainToPlatform<C>>(
      config.network,
      config.platform as ChainToPlatform<C>,
      {},
    );
  }
}
