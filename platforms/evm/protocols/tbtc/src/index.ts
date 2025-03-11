import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmTbtcBridge } from './bridge.js';

registerProtocol(_platform, 'TbtcBridge', EvmTbtcBridge);

export * from './bridge.js';
