import { Chain, ChainContext, Network } from '@wormhole-foundation/connect-sdk';
import { EvmChains } from './types';

export class EvmChain<
  N extends Network = Network,
  P extends 'Evm' = 'Evm',
  C extends Chain = EvmChains,
> extends ChainContext<N, P, C> {}
