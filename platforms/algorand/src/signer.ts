import type {
  Network,
  SignOnlySigner,
  SignedTx,
  Signer,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-connect";
import type algosdk from "algosdk";
import { assignGroupID, mnemonicToSecretKey } from "algosdk";
import type { AlgorandChains, TransactionSignerPair } from "./types.js";
import { AlgorandPlatform } from "./platform.js";

export async function getAlgorandSigner(
  rpc: algosdk.Algodv2,
  mnemonic: string, // 25-word Algorand mnemonic
): Promise<Signer> {
  const [network, chain] = await AlgorandPlatform.chainFromRpc(rpc);
  return new AlgorandSigner<typeof network, typeof chain>(chain, rpc, mnemonic);
}

// AlgorandSigner implements SignOnlySender
export class AlgorandSigner<N extends Network, C extends AlgorandChains>
  implements SignOnlySigner<N, C>
{
  _account: algosdk.Account;
  constructor(
    private _chain: C,
    _rpc: algosdk.Algodv2,
    mnemonic: string,
    private _debug: boolean = false,
  ) {
    this._account = mnemonicToSecretKey(mnemonic);
  }

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._account.addr;
  }

  async sign(unsignedTxns: UnsignedTransaction[]): Promise<SignedTx[]> {
    const signed: Uint8Array[] = [];
    const ungrouped = unsignedTxns.map((val, idx) => {
      return val.transaction.tx;
    });
    const grouped = assignGroupID(ungrouped);

    // Replace the ungrouped Transactions with grouped Transactions
    const groupedAlgoUnsignedTxns = unsignedTxns.map((val, idx) => {
      val.transaction.tx = grouped[idx];
      return val;
    });

    for (const algoUnsignedTxn of groupedAlgoUnsignedTxns) {
      const { description, transaction: tsp } = algoUnsignedTxn;
      const { tx, signer } = tsp as TransactionSignerPair;

      if (this._debug) {
        console.log(tx._getDictForDisplay());
        console.log(tx.txID());
      }

      if (signer) {
        if (this._debug)
          console.log(
            `Signing: ${description} with signer ${signer.address} for address ${this.address()}`,
          );
        signed.push(await signer.signTxn(tx));
      } else {
        if (this._debug)
          console.log(`Signing: ${description} without signer for address ${this.address()}`);
        signed.push(tx.signTxn(this._account.sk));
      }
    }

    return signed;
  }
}
