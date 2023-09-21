import {
  ChainContext,
  ChainConfig,
  Platform,
  RpcConnection,
  ChainName,
} from '@wormhole-foundation/connect-sdk';
import { EvmPlatform } from './platform';

export class EvmChain extends ChainContext<'Evm'> {
  readonly platform: Platform<'Evm'> = EvmPlatform;
}
