import { ChainContext, Platform } from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from './platform';

export class EvmChain extends ChainContext<'Evm'> {
  // @ts-ignore
  readonly platform: Platform<'Evm'> = EvmPlatform;
}
