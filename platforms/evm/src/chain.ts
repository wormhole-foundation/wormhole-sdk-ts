import type { Chain, Network } from '@wormhole-foundation/sdk-connect';
import { ChainContext } from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from './types.js';

/**
 * A ChainContext for the EVM platform
 */
export class EvmChain<
  N extends Network = Network,
  C extends Chain = EvmChains,
> extends ChainContext<N, C> {}
