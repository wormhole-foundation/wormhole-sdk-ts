import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
} from '@wormhole-foundation/connect-sdk';
import { Account, assignGroupID, mnemonicToSecretKey } from 'algosdk';
import { AlgorandPlatform } from '../platform';
import { AlgorandUnsignedTransaction } from '../unsignedTransaction';

// returns a SignOnlySigner for the Algorand platform
export async function getAlgorandSigner(
  rpc: RpcConnection<'Algorand'>,
  mnemonic: string, // 25-word Algorand mnemonic
): Promise<Signer> {
  const [_, chain] = await AlgorandPlatform.chainFromRpc(rpc);

  return new AlgorandSigner(chain, mnemonicToSecretKey(mnemonic));
}

export class AlgorandSigner implements SignOnlySigner {
  constructor(private _chain: ChainName, private _account: Account) {}

  chain(): ChainName {
    return this._chain;
  }

  address(): string {
    return this._account.addr;
  }

  async sign(
    algoUnsignedTxns: AlgorandUnsignedTransaction[],
  ): Promise<Uint8Array[]> {
    const signed: Uint8Array[] = [];
    const ungrouped = algoUnsignedTxns.map((val, idx) => {
      return val.transaction.tx;
    });
    const grouped = assignGroupID(ungrouped);

    // Replace the ungrouped Transactions with grouped Transactions
    const groupedAlgoUnsignedTxns = algoUnsignedTxns.map((val, idx) => {
      val.transaction.tx = grouped[idx];
      return val;
    });

    for (const algoUnsignedTxn of groupedAlgoUnsignedTxns) {
      const { description, transaction: tsp } = algoUnsignedTxn;
      const { tx, signer } = tsp;

      if (signer) {
        console.log(
          `Signing: ${description} transaction ${tx._getDictForDisplay()} with signer ${
            signer.addr
          } for address ${this.address()}`,
        );
        signed.push(await signer.signTxn(tx));
      } else {
        console.log(
          `Signing: ${description} transaction ${tx._getDictForDisplay()} with signer ${this.address()} for address ${this.address()}`,
        );
        signed.push(tx.signTxn(this._account.sk));
      }
    }

    return signed;
  }
}
