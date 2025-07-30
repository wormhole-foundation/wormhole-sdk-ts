import { Network, SignedTx, SignAndSendSigner, UnsignedTransaction, TxHash } from "@wormhole-foundation/sdk-connect";
import { StacksChains } from "./types.js";
import { broadcastTransaction, makeContractCall, privateKeyToAddress, StacksTransactionWire } from "@stacks/transactions";
import { StacksNetwork } from "@stacks/network";

export async function getStacksSigner
<N extends Network, C extends StacksChains>(
  chain: C,
  provider: StacksNetwork, // TODO FG TODO type
  privateKey: string,
): Promise<SignAndSendSigner<N, C>> {
  return new StacksSigner<N, C>(chain, provider, privateKey);
}

export class StacksSigner<N extends Network, C extends StacksChains> implements SignAndSendSigner<N, C> {

  private readonly _address: string

  constructor(
    private _chain: C,
    private _provider: StacksNetwork, // TODO FG TODO type
    private _privKey: string,
  ) {
    this._address = privateKeyToAddress(this._privKey);
  }

  async signAndSend(txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> {
    const signed: StacksTransactionWire[] = []
    for (const tx of txs) {
      const signedTx = await makeContractCall({
        ...tx.transaction,
        senderKey: this._privKey,
        network: (this._chain as any).network.toLowerCase(),
        client: {
          baseUrl: this._provider.client.baseUrl
        }
      })
      signed.push(signedTx)
    }

    const txHashes = await Promise.all(signed.map(async (signedTx) => {
      const txBroadcastResult = await broadcastTransaction({
        transaction: signedTx,
        client: {
          baseUrl: this._provider.client.baseUrl
        }
      })
      return txBroadcastResult.txid
    }))

    return txHashes
  }

  /**
   * 
   * Stacks has different types of transactions.
   * We are assuming that we're only signing contract interaction transactions.
   * TODO FG TODO - check this
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
