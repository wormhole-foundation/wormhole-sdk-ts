import {
  Network,
  RpcConnection,
  SignAndSendSigner,
  Signer,
  TxHash,
  UnsignedTransaction,
  encoding,
} from "@wormhole-foundation/connect-sdk";
import { AptosAccount, AptosClient, TxnBuilderTypes, Types } from "aptos";
import { AptosPlatform } from "../platform";
import { AptosChains } from "../types";

// returns a SignOnlySigner for the Aptos platform
export async function getAptosSigner(
  rpc: RpcConnection<"Aptos">,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await AptosPlatform.chainFromRpc(rpc);
  return new AptosSigner(chain, new AptosAccount(encoding.hex.decode(privateKey)), rpc);
}

export class AptosSigner<N extends Network, C extends AptosChains>
  implements SignAndSendSigner<N, C>
{
  constructor(
    private _chain: C,
    private _account: AptosAccount,
    private _rpc: AptosClient,
  ) {}

  chain() {
    return this._chain;
  }

  address(): string {
    return this._account.address().hex();
  }

  async signAndSend(tx: UnsignedTransaction[]): Promise<TxHash[]> {
    const txhashes = [];
    for (const txn of tx) {
      const { description, transaction } = txn as {
        description: string;
        transaction: Types.EntryFunctionPayload;
      };
      console.log(`Signing: ${description} for ${this.address()}`);

      // overwriting `max_gas_amount` and `gas_unit_price` defaults
      // rest of defaults are defined here: https://aptos-labs.github.io/ts-sdk-doc/classes/AptosClient.html#generateTransaction
      const customOpts = {
        gas_unit_price: "100",
        max_gas_amount: "30000",
        expiration_timestamp_secs: (BigInt(Date.now() + 8 * 60 * 60 * 1000) / 1000n).toString(),
      } as Partial<Types.SubmitTransactionRequest>;

      const tx = await this._rpc.generateTransaction(
        this._account.address(),
        transaction,
        customOpts,
      );

      const { hash } = await this._simSignSend(tx);
      txhashes.push(hash);
    }
    return txhashes;
  }

  private async _simSignSend(rawTx: TxnBuilderTypes.RawTransaction): Promise<Types.Transaction> {
    // simulate transaction
    await this._rpc.simulateTransaction(this._account, rawTx).then((sims) =>
      sims.forEach((tx) => {
        if (!tx.success) {
          throw new Error(`Transaction failed: ${tx.vm_status}\n${JSON.stringify(tx, null, 2)}`);
        }
      }),
    );

    // sign & submit transaction
    return this._rpc
      .signTransaction(this._account, rawTx)
      .then((signedTx) => this._rpc.submitTransaction(signedTx))
      .then((pendingTx) => this._rpc.waitForTransactionWithResult(pendingTx.hash));
  }
}
