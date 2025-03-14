import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-solana';
import { SolanaTBTCBridge } from './bridge.js';

registerProtocol(_platform, 'TBTCBridge', SolanaTBTCBridge);

export * from './bridge.js';
