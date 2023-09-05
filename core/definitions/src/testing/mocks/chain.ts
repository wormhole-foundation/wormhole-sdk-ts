import { ChainName, PlatformName } from "@wormhole-foundation/sdk-base";
import { RpcConnection, ChainContext, Platform } from "../..";

export function chainFactory<P extends PlatformName>(
  p: Platform<P>,
  chain: ChainName
): ChainContext<P> {
  return new MockChain<P>(p, chain);
}

export class MockChain<P extends PlatformName> extends ChainContext<P> {
  private rpc?: RpcConnection<P>;

  getRpc(): RpcConnection<P> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc!;
  }
}
