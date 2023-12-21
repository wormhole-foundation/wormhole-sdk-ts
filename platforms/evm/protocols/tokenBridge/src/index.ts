import { registerProtocol } from '@wormhole-foundation/connect-sdk';
import { _platform } from '@wormhole-foundation/connect-sdk-evm';
import { EvmTokenBridge } from './tokenBridge';
import { EvmAutomaticTokenBridge } from './automaticTokenBridge';

declare global {
  namespace WormholeNamespace {
    export interface PlatformToProtocolMapping {
      Evm: {};
    }
  }
}

registerProtocol(_platform, 'TokenBridge', EvmTokenBridge);
registerProtocol(_platform, 'AutomaticTokenBridge', EvmAutomaticTokenBridge);

export * as ethers_contracts from './ethers-contracts';
export * from './tokenBridge';
export * from './automaticTokenBridge';
