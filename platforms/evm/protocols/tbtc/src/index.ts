import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmTBTCBridge } from './bridge.js';

registerProtocol(_platform, 'TBTCBridge', EvmTBTCBridge);

export * from './bridge.js';
