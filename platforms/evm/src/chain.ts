import {
  ChainContext,
  ChainConfig,
  Platform,
  RpcConnection,
  ChainName,
} from '@wormhole-foundation/connect-sdk';

export class EvmChain extends ChainContext<'Evm'> {
  readonly chain: ChainName;
  readonly platform: Platform<'Evm'>;
  readonly conf: ChainConfig;

  // Cached objects
  private provider?: RpcConnection<'Evm'>;

  constructor(platform: Platform<'Evm'>, chain: ChainName) {
    super(platform, chain);

    this.chain = chain;
    this.conf = platform.conf[chain]!;
    this.platform = platform;
  }

  getRpc(): RpcConnection<'Evm'> {
    this.provider = this.provider
      ? this.provider
      : this.platform.getRpc(this.chain);

    return this.provider!;
  }
}
