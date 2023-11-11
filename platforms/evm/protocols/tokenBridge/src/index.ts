import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { EvmTokenBridge } from './tokenBridge';
import { EvmAutomaticTokenBridge } from './automaticTokenBridge';

declare global {
  namespace Wormhole {
    export interface PlatformToProtocolMapping {
      Evm: {};
    }
  }
}

registerProtocol('Evm', 'TokenBridge', EvmTokenBridge);
registerProtocol('Evm', 'AutomaticTokenBridge', EvmAutomaticTokenBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './tokenBridge';
export * from './automaticTokenBridge';
