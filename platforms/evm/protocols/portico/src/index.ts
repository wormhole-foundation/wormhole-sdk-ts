import { registerProtocol } from '@wormhole-foundation/sdk-connect';
import { _platform } from '@wormhole-foundation/sdk-evm';
import { EvmPorticoBridge } from './bridge';

registerProtocol(_platform, 'PorticoBridge', EvmPorticoBridge);

export * from './bridge';
