import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { ChainConfig, ChainContext, Platform } from "../..";
import { mockPlatformFactory } from "./platform";

export function chainFactory<P extends PlatformName>(
  p: Platform<P>,
  chain: ChainName,
): ChainContext<P> {
  return p.getChain(chain);
}

export class MockChain<P extends PlatformName> extends ChainContext<P> {
  readonly platform: Platform<P>;
  constructor(conf: ChainConfig) {
    super(conf);
    this.platform = mockPlatformFactory<P>(conf.network, conf.platform as P, {});
  }
}
