import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { EvmCircleBridge } from './circleBridge';
import { EvmAutomaticCircleBridge } from './automaticCircleBridge';

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Evm: {};
    }
  }
}

registerProtocol('Evm', 'CircleBridge', EvmCircleBridge);
registerProtocol('Evm', 'AutomaticCircleBridge', EvmAutomaticCircleBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './circleBridge';
export * from './automaticCircleBridge';
