import { Chain, ChainContext, Network } from '@wormhole-foundation/sdk-connect';
import { EvmChains } from './types';

/**
 * A ChainContext for the EVM platform
 */
export class EvmChain<
  N extends Network = Network,
  C extends Chain = EvmChains,
> extends ChainContext<N, C> {}
