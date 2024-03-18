import type { Coder, Idl } from '@coral-xyz/anchor';
import { WormholeAccountsCoder } from './accounts.js';
import { WormholeEventsCoder } from './events.js';
import { WormholeInstructionCoder } from './instruction.js';
import { WormholeStateCoder } from './state.js';
import { WormholeTypesCoder } from './types.js';

export * from './instruction.js';

export class WormholeCoder implements Coder {
  readonly instruction: WormholeInstructionCoder;
  readonly accounts: WormholeAccountsCoder;
  readonly state: WormholeStateCoder;
  readonly events: WormholeEventsCoder;
  readonly types: WormholeTypesCoder;

  constructor(idl: Idl) {
    this.instruction = new WormholeInstructionCoder(idl);
    this.accounts = new WormholeAccountsCoder(idl);
    this.state = new WormholeStateCoder(idl);
    this.events = new WormholeEventsCoder(idl);
    this.types = new WormholeTypesCoder(idl);
  }
}
