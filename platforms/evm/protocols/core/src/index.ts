import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { EvmWormholeCore } from './wormholeCore';

// @ts-ignore
registerProtocol('Evm', 'WormholeCore', EvmWormholeCore);

export * as ethers_contracts from './ethers-contracts';
export * from './wormholeCore';
