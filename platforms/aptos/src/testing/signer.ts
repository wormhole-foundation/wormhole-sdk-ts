import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
  encoding,
} from "@wormhole-foundation/connect-sdk";
import { AptosPlatform } from "../platform";
import { AptosAccount, AptosClient } from "aptos";

// returns a SignOnlySigner for the Aptos platform
export async function getAptosSigner(
  rpc: RpcConnection<"Aptos">,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await AptosPlatform.chainFromRpc(rpc);
  return new AptosSigner(chain, new AptosAccount(encoding.hex.decode(privateKey)), rpc);
}

export class AptosSigner implements SignOnlySigner {
  constructor(private _chain: ChainName, private _account: AptosAccount, private _rpc: AptosClient) { }

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._account.address().hex();
  }

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const rawTx = await this._rpc.generateTransaction(this._account.address(), transaction)

      // simulate transaction
      await this._rpc.simulateTransaction(this._account, rawTx).then((sims) =>
        sims.forEach((tx) => {
          if (!tx.success) {
            throw new Error(
              `Transaction failed: ${tx.vm_status}\n${JSON.stringify(tx, null, 2)}`
            );
          }
        })
      );

      // sign the transaction 
      const signedTx = this._rpc.signTransaction(this._account, rawTx)
      signed.push(signedTx)
    }
    return signed;
  }
}
