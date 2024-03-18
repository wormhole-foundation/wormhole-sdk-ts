import type { EventCoder, Event, Idl } from '@coral-xyz/anchor';
import type { anchor } from '@wormhole-foundation/sdk-solana';

export class TokenBridgeEventsCoder implements EventCoder {
  constructor(_idl: Idl) {}

  decode<
    E extends anchor.IdlEvent = anchor.IdlEvent,
    T = Record<string, string>,
  >(_log: string): Event<E, T> | null {
    throw new Error('Token Bridge program does not have events');
  }
}
