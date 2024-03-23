import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-solana';
import { solanaNttProtocolFactory } from './ntt.js';

registerProtocol(_platform, 'Ntt', solanaNttProtocolFactory);

export * as idl from './anchor-idl/index.js';
export * from './ntt.js';
