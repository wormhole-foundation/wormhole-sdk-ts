import { Network, Chain, ChainContext, PlatformUtils, PlatformToChains } from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from './platform';

export class EvmChain<
  N extends Network = typeof EvmPlatform.network,
  C extends Chain = PlatformToChains<EvmPlatform.Type>
> extends ChainContext<N, C> {
  // @ts-ignore
  readonly platform: PlatformUtils<N, EvmPlatform.Type> = EvmPlatform;
}
