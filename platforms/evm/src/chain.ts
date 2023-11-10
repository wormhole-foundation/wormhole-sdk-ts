import { Chain, ChainContext, Network, PlatformContext } from '@wormhole-foundation/connect-sdk';
import { EvmChains } from './types';

export class EvmChain<
  N extends Network = Network,
  C extends Chain = EvmChains,
  P extends 'Evm' = 'Evm',
> extends ChainContext<N, C, P> {
  override platform: PlatformContext<N, P>;
}
