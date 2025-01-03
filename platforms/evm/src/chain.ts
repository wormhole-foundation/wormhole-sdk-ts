import type { Network } from '@wormhole-foundation/sdk-connect';
import { ChainContext } from '@wormhole-foundation/sdk-connect';
import type { Provider } from 'ethers';
import type { EvmChains } from './types.js';
import type { EvmPlatform } from './platform.js';

/**
 * A ChainContext for the EVM platform
 * Handles chain-specific operations for EVM-compatible networks
 */
export class EvmChain<
  N extends Network = Network,
  C extends EvmChains = EvmChains,
> extends ChainContext<N, C> {
  protected readonly platform: EvmPlatform<N>;
  protected readonly chain: C;

  constructor(
    chain: C,
    platform: EvmPlatform<N>,
    private rpcProvider?: Provider,
  ) {
    super(chain, platform);
    this.platform = platform;
    this.chain = chain;
  }

  /**
   * Get the RPC provider for this chain
   */
  getRpcProvider(): Provider {
    return this.rpcProvider ?? this.platform.getRpc(this.chain);
  }
}
