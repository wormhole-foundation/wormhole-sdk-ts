import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Account, mnemonicToSecretKey } from 'algosdk';
import { AlgorandPlatform } from '../platform';

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

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      const stxn = transaction.signTxn(this._account.sk);
      signed.push(stxn);
    }
    return signed;
  }
}
