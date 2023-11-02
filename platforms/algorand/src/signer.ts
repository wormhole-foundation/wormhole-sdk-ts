import {
  ChainContext,
  ChainName,
  PlatformName,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Account, mnemonicToSecretKey } from 'algosdk';

// returns a SignOnlySigner for the Algorand platform
export function getAlgorandSigner(
  chain: ChainContext<PlatformName>,
  mnemonic: string, // 25-word Algorand mnemonic
): Signer {
  return new AlgorandSigner(chain.chain, mnemonicToSecretKey(mnemonic));
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
