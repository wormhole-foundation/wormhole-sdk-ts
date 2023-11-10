import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { EvmTokenBridge } from './tokenBridge';
import { EvmAutomaticTokenBridge } from './automaticTokenBridge';

//@ts-ignore
registerProtocol('Evm', 'TokenBridge', EvmTokenBridge);
//@ts-ignore
registerProtocol('Evm', 'AutomaticTokenBridge', EvmAutomaticTokenBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './tokenBridge';
export * from './automaticTokenBridge';
