import { _platform } from '@wormhole-foundation/sdk-solana';
import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaTokenBridge } from './tokenBridge.js';
import { SolanaAutomaticTokenBridge } from './automaticTokenBridge.js';
import { SolanaTokenBridgeExecutor } from './tokenBridgeExecutor.js';

registerProtocol(_platform, 'TokenBridge', SolanaTokenBridge);
registerProtocol(_platform, 'AutomaticTokenBridge', SolanaAutomaticTokenBridge);
registerProtocol(_platform, 'TokenBridgeExecutor', SolanaTokenBridgeExecutor);

export * from './tokenBridgeType.js';
export * from './automaticTokenBridgeType.js';
export * from './utils/index.js';
export * from './tokenBridge.js';
export * from './automaticTokenBridge.js';
export * from './tokenBridgeExecutor.js';
export * from './tokenBridgeExecutorTypes.js';
