import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmNtt } from './ntt.js';

registerProtocol(_platform, 'NTT', EvmNtt);

export * as ethers_contracts from './ethers-contracts/index.js';
export * from './ntt.js';
