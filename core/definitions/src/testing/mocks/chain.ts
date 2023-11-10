import { Chain, Platform } from "@wormhole-foundation/sdk-base";
import { ChainConfig, ChainContext, Platform } from "../..";
import { mockPlatformFactory } from "./platform";

export function chainFactory<P extends Platform>(
  p: Platform<P>,
  chain: Chain,
): ChainContext<P> {
  return p.getChain(chain);
}

export class MockChain<P extends Platform> extends ChainContext<P> {
  readonly platform: Platform<P>;
  constructor(config: ChainConfig) {
    super(config);
    this.platform = mockPlatformFactory<P>(config.network, config.platform as P, {});
  }
}
