import type { Coder, Idl } from '@coral-xyz/anchor';
import { TokenBridgeAccountsCoder } from './accounts.js';
import { TokenBridgeEventsCoder } from './events.js';
import { TokenBridgeInstructionCoder } from './instruction.js';
import { TokenBridgeStateCoder } from './state.js';
import { TokenBridgeTypesCoder } from './types.js';

export * from './instruction.js';

export class TokenBridgeCoder implements Coder {
  readonly instruction: TokenBridgeInstructionCoder;
  readonly accounts: TokenBridgeAccountsCoder;
  readonly state: TokenBridgeStateCoder;
  readonly events: TokenBridgeEventsCoder;
  readonly types: TokenBridgeTypesCoder;

  constructor(idl: Idl) {
    this.instruction = new TokenBridgeInstructionCoder(idl);
    this.accounts = new TokenBridgeAccountsCoder(idl);
    this.state = new TokenBridgeStateCoder(idl);
    this.events = new TokenBridgeEventsCoder(idl);
    this.types = new TokenBridgeTypesCoder(idl);
  }
}
