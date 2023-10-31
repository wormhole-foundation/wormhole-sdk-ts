import { EvmPlatform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmCircleBridge } from './circleBridge';
import { EvmAutomaticCircleBridge } from './automaticCircleBridge';

export function registerProtocols(): void {
    // Register this module with the EVM module
    EvmPlatform.registerProtocol('CircleBridge', EvmCircleBridge);
    EvmPlatform.registerProtocol('AutomaticCircleBridge', EvmAutomaticCircleBridge);
}


export * as ethers_contracts from './ethers-contracts';
export * from './circleBridge';
export * from './automaticCircleBridge';
