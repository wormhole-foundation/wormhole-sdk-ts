import { Chain, ChainContext, Network } from '@wormhole-foundation/connect-sdk';
import { EvmChains } from './types';

export class EvmChain<
  N extends Network = Network,
  C extends Chain = EvmChains,
> extends ChainContext<N, 'Evm', C> {}
