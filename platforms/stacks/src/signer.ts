import { Network, SignedTx, SignAndSendSigner, UnsignedTransaction, TxHash } from "@wormhole-foundation/sdk-connect";
import { StacksChains } from "./types.js";
import { broadcastTransaction, makeContractCall, privateKeyToAddress, StacksTransactionWire } from "@stacks/transactions";
import { StacksNetwork, StacksNetworkName } from "@stacks/network";
import { StacksPlatform } from "./platform.js";

export async function getStacksSigner(
  rpc: StacksNetwork,
  privateKey: string,
): Promise<SignAndSendSigner<Network, StacksChains>> {
  const [network, chain] = await StacksPlatform.chainFromRpc(rpc);
  return new StacksSigner(chain, network, rpc, privateKey);
}

export class StacksSigner<N extends Network, C extends StacksChains> implements SignAndSendSigner<N, C> {

  private readonly _address: string

  constructor(
    private _chain: C,
    private _network: Network,
    private _provider: StacksNetwork,
    private _privKey: string,
  ) {
    this._address = privateKeyToAddress(this._privKey, this._network.toLowerCase() as StacksNetworkName);
  }

  async signAndSend(txs: UnsignedTransaction<N, C>[]): Promise<TxHash[]> {
    const signed: StacksTransactionWire[] = []
    for (const tx of txs) {
      const signedTx = await makeContractCall({
        ...tx.transaction,
        senderKey: this._privKey,
        network: this._network.toLowerCase(),
        client: this._provider.client
      })
      signed.push(signedTx)
    }

    const txHashes = await Promise.all(signed.map(async (signedTx) => {
      const txBroadcastResult: any = await broadcastTransaction({
        transaction: signedTx,
        client: this._provider.client
      })
      if(txBroadcastResult.error) {
        console.log(signedTx)
        throw new Error(`Failed to broadcast transaction: ${txBroadcastResult.error} ${txBroadcastResult.reason} - ${txBroadcastResult.txid} -`)
      }
      return txBroadcastResult.txid
    }))

    return txHashes
  }

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
