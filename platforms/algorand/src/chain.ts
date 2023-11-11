import { ChainContext, Platform } from '@wormhole-foundation/connect-sdk';
import { AlgorandPlatform } from './platform';

export class AlgorandChain extends ChainContext<'Algorand'> {
  readonly platform: Platform<'Algorand'> = AlgorandPlatform;
}
