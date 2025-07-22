import { Network, SignedTx, SignOnlySigner, UnsignedTransaction } from "@wormhole-foundation/sdk-connect";
import { StacksChains } from "./types.js";
import { makeContractCall } from "@stacks/transactions";

export class StacksSigner<N extends Network, C extends StacksChains = StacksChains> implements SignOnlySigner<N, C> {

  constructor(
    private _chain: C,
    private _address: string,
  ) {}

  /**
   * 
   * Stacks has different types of transactions.
   * We are assuming that we're only signing contract interaction transactions.
   */
  async sign(tx: UnsignedTransaction<N, C>[]): Promise<SignedTx[]> {
    const signedTxs = tx.map(async (t) => {
      const transaction = t.transaction;
      return makeContractCall(transaction)
    })
    return Promise.all(signedTxs)
  }
  
  chain(): C {
    return this._chain
  }
  address(): string {
    return this._address
  }
}
