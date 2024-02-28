import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmCircleBridge } from './circleBridge';
import { EvmAutomaticCircleBridge } from './automaticCircleBridge';

registerProtocol(_platform, 'CircleBridge', EvmCircleBridge);
registerProtocol(_platform, 'AutomaticCircleBridge', EvmAutomaticCircleBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './circleBridge';
export * from './automaticCircleBridge';
