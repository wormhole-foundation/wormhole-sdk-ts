import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { evmNttProtocolFactory } from './ntt.js';

registerProtocol(_platform, 'NTT', evmNttProtocolFactory);

export * as ethers_contracts from './ethers-contracts/index.js';
export * from './ntt.js';
