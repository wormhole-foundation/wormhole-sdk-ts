import { EvmPlatform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmWormholeCore } from './wormholeCore';

export function registerProtocols(): void {
    // Register this module with the EVM module
    EvmPlatform.registerProtocol('WormholeCore', EvmWormholeCore);
}

export * as ethers_contracts from './ethers-contracts';
export * from './wormholeCore';