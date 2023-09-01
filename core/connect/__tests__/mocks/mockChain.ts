import {
  RpcConnection,
  ChainContext,
} from '@wormhole-foundation/sdk-definitions';

type P = 'Evm';
export class MockChain extends ChainContext<P> {
  private rpc?: RpcConnection<P>;

  getRpc(): RpcConnection<P> {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc!;
  }
}
