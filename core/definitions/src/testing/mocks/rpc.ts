import { ChainName } from "@wormhole-foundation/sdk-base";

export class MockRpc {
  constructor(chain: ChainName) {}

  getBalance(address: string): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  broadcastTransaction(stxns: any): any {
    throw new Error("Not implemented");
  }
}
