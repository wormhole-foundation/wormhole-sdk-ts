import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmTBTCBridge } from './tbtcBridge.js';

registerProtocol(_platform, 'TBTCBridge', EvmTBTCBridge);

export * from './tbtcBridge.js';
