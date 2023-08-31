import {
  AutomaticTokenBridge,
  TokenBridge,
  UniversalAddress,
  Platform,
  RpcConnection,
  ChainContext,
  SignedTxn,
  TxHash,
  TokenId,
  WormholeMessageId,
  CircleBridge,
  AutomaticCircleBridge,
} from '@wormhole-foundation/sdk-definitions';
import {
  ChainName,
  Network,
  PlatformName,
} from '@wormhole-foundation/sdk-base';
import { TokenTransferTransaction } from '../../src/';
import { MockRpc } from './mockPlatform';
import { MockTokenBridge } from './mockTokenBridge';

export class MockChain extends ChainContext<'Evm'> {
  readonly chain: ChainName;
  readonly platform: Platform<'Evm'>;

  // Cached objects
  private tokenBridge?: MockTokenBridge;

  constructor(platform: Platform<'Evm'>, chain: ChainName) {
    super(platform, chain);
    this.platform = platform;
  }

  getRpc(): MockRpc {
    this.rpc = this.rpc ? this.rpc : this.platform.getRpc(this.chain);
    return this.rpc!;
  }
}
