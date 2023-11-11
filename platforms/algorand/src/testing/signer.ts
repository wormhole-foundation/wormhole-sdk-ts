import algosdk, { Account } from 'algosdk';
import {
  ChainName,
  RpcConnection,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { AlgorandPlatform } from '../platform';

// TODO: Add alternative signer from `privateKey: string` ALGORAND_PRIVATE_KEY
export async function getAlgorandSigner(
  rpc: RpcConnection<'Algorand'>,
  mnemonic: string,
): Promise<Signer> {
  const [_, chain] = await AlgorandPlatform.chainFromRpc(rpc);
  return new AlgorandSigner(chain, algosdk.mnemonicToSecretKey(mnemonic));
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
      signed.push(transaction.sign(this._account.sk));
    }
    return signed;
  }
}
