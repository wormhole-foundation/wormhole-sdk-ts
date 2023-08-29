import { VAA, deserialize } from '@wormhole-foundation/sdk-definitions';

export class MockApi {
  constructor(readonly url: string) {}

  async getVaaBytes(): Promise<VAA<'Uint8Array'>> {
    throw new Error('Not implemented');
    return deserialize('Uint8Array', new Uint8Array());
  }
}
