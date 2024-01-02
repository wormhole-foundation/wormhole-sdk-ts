import { Keypair, Transaction } from '@solana/web3.js';
import {
  SignOnlySigner,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Network } from '@wormhole-foundation/sdk-base/src';
import { SolanaChains } from '../types';

export class SolanaSigner<N extends Network, C extends SolanaChains = 'Solana'>
  implements SignOnlySigner<N, C>
{
  constructor(
    private _chain: C,
    private _keypair: Keypair,
    private _debug: boolean = false,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._keypair.publicKey.toBase58();
  }

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const signed = [];
    for (const txn of tx) {
      const { description, transaction } = txn;
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) {
        const st = transaction as Transaction;
        console.log(st.signatures);
        console.log(st.feePayer);
        st.instructions.forEach((ix) => {
          console.log('Program', ix.programId.toBase58());
          console.log('Data: ', ix.data.toString('hex'));
          ix.keys.forEach((k) => {
            console.log(k, k.pubkey.toBase58());
          });
        });
      }

      transaction.partialSign(this._keypair);
      signed.push(transaction.serialize());
    }
    return signed;
  }
}
