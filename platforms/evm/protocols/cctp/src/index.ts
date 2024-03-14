import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmCircleBridge } from './circleBridge.js';
import { EvmAutomaticCircleBridge } from './automaticCircleBridge.js';

registerProtocol(_platform, 'CircleBridge', EvmCircleBridge);
registerProtocol(_platform, 'AutomaticCircleBridge', EvmAutomaticCircleBridge);

export * as ethers_contracts from './ethers-contracts/index.js';
export * from './circleBridge.js';
export * from './automaticCircleBridge.js';
