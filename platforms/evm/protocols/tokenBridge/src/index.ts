import { EvmPlatform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmTokenBridge } from './tokenBridge';
import { EvmAutomaticTokenBridge } from './automaticTokenBridge';

export function registerProtocols(): void {
    // Register this module with the EVM module
    EvmPlatform.registerProtocol('TokenBridge', EvmTokenBridge);
    EvmPlatform.registerProtocol('AutomaticTokenBridge', EvmAutomaticTokenBridge);
}

export * as ethers_contracts from './ethers-contracts';
export * from './tokenBridge';
export * from './automaticTokenBridge';


