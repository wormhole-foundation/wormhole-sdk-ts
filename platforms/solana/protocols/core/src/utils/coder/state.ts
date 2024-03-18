import type { Idl, StateCoder } from '@coral-xyz/anchor';

export class WormholeStateCoder implements StateCoder {
  constructor(_idl: Idl) {}

  encode<T = any>(_name: string, _account: T): Promise<Buffer> {
    throw new Error('Wormhole program does not have state');
  }
  decode<T = any>(_ix: Buffer): T {
    throw new Error('Wormhole program does not have state');
  }
}
