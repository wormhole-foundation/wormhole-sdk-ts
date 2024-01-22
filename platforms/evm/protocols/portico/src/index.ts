import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { _platform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmPorticoBridge } from './bridge';

registerProtocol(_platform, 'PorticoBridge', EvmPorticoBridge);

export * from './bridge';
