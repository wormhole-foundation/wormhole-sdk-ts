import { Coder, Idl } from '@project-serum/anchor';
import { NftBridgeAccountsCoder } from './accounts.js';
import { NftBridgeEventsCoder } from './events.js';
import { NftBridgeInstructionCoder } from './instruction.js';
import { NftBridgeStateCoder } from './state.js';
import { NftBridgeTypesCoder } from './types.js';

export { NftBridgeInstruction } from './instruction.js';

export class NftBridgeCoder implements Coder {
  readonly instruction: NftBridgeInstructionCoder;
  readonly accounts: NftBridgeAccountsCoder;
  readonly state: NftBridgeStateCoder;
  readonly events: NftBridgeEventsCoder;
  readonly types: NftBridgeTypesCoder;

  constructor(idl: Idl) {
    this.instruction = new NftBridgeInstructionCoder(idl);
    this.accounts = new NftBridgeAccountsCoder(idl);
    this.state = new NftBridgeStateCoder(idl);
    this.events = new NftBridgeEventsCoder(idl);
    this.types = new NftBridgeTypesCoder(idl);
  }
}
