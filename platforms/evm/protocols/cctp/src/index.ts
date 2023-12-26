import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { _platform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmCircleBridge } from './circleBridge';
import { EvmAutomaticCircleBridge } from './automaticCircleBridge';

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Evm: {};
    }
  }
}

registerProtocol(_platform, 'CircleBridge', EvmCircleBridge);
registerProtocol(_platform, 'AutomaticCircleBridge', EvmAutomaticCircleBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './circleBridge';
export * from './automaticCircleBridge';
