import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { RpcConnection, ChainContext, Platform } from "../..";
import { mockPlatformFactory } from "./platform";

export function chainFactory<P extends PlatformName>(
  p: Platform<P>,
  chain: ChainName
): ChainContext<P> {
  return new MockChain<P>(p.platform, chain);
}

export class MockChain<P extends PlatformName> extends ChainContext<P> {
  readonly platform: Platform<P>;
  constructor(platform: PlatformName, readonly chain: ChainName) {
    super(chain);
    this.platform = mockPlatformFactory<P>(platform as P, {});
  }
}
