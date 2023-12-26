import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { _platform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmWormholeCore } from './wormholeCore';

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Evm: {};
    }
  }
}

registerProtocol(_platform, 'WormholeCore', EvmWormholeCore);

export * as ethers_contracts from './ethers-contracts';
export * from './wormholeCore';
