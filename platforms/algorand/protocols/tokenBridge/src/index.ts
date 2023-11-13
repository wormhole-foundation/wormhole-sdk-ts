import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { AlgorandTokenBridge } from './tokenBridge';
registerProtocol('Algorand', 'TokenBridge', AlgorandTokenBridge);

export * from './tokenBridge';
export * from './utils';
export * from './BigVarint';
export * from './TmplSig';
