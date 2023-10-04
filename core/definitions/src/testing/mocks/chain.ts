import {
  ChainName,
  Network,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import { ChainContext, Platform } from '../..';
import { mockPlatformFactory } from './platform';

export function chainFactory<P extends PlatformName>(
  network: Network,
  p: Platform<P>,
  chain: ChainName,
): ChainContext<P> {
  return new MockChain<P>(network, p.platform, chain);
}

export class MockChain<P extends PlatformName> extends ChainContext<P> {
  readonly platform: Platform<P>;
  constructor(
    network: Network,
    platform: PlatformName,
    readonly chain: ChainName,
  ) {
    super(chain);
    this.platform = mockPlatformFactory<P>(network, platform as P, {});
  }
}
