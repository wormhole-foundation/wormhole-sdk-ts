import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmTokenBridge } from './tokenBridge.js';
import { EvmExecutorTokenBridge } from './executorTokenBridge.js';

registerProtocol(_platform, 'TokenBridge', EvmTokenBridge);
registerProtocol(_platform, 'ExecutorTokenBridge', EvmExecutorTokenBridge);

export * as ethers_contracts from './ethers-contracts/index.js';
export * from './tokenBridge.js';
export * from './executorTokenBridge.js';
