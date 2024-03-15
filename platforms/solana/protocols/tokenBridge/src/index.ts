import { _platform } from '@wormhole-foundation/sdk-solana';
import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { SolanaTokenBridge } from './tokenBridge.js';
import { SolanaAutomaticTokenBridge } from './automaticTokenBridge.js';

registerProtocol(_platform, 'TokenBridge', SolanaTokenBridge);
registerProtocol(_platform, 'AutomaticTokenBridge', SolanaAutomaticTokenBridge);

export * from './tokenBridgeType.js';
export * from './automaticTokenBridgeType.js';
export * from './utils/index.js';
export * from './tokenBridge.js';
export * from './automaticTokenBridge.js';
