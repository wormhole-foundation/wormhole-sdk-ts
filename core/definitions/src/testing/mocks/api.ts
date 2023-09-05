import { VAA } from "../..";

export class MockApi {
  constructor(readonly url: string) {}

  async getVaaBytes(): Promise<VAA<"Uint8Array">> {
    throw new Error("Not implemented");
  }
}
