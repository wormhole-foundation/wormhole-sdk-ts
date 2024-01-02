import { Connection, Keypair, Transaction } from '@solana/web3.js';
import {
  SignAndSendSigner,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Network } from '@wormhole-foundation/sdk-base/src';
import { SolanaPlatform } from '../platform';
import { SolanaChains } from '../types';
import { SolanaUnsignedTransaction } from '../unsignedTransaction';

export class SolanaSendSigner<
  N extends Network,
  C extends SolanaChains = 'Solana',
> implements SignAndSendSigner<N, C>
{
  constructor(
    private _rpc: Connection,
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

  async signAndSend(tx: UnsignedTransaction[]): Promise<any[]> {
    const txids: string[] = [];

    const { blockhash, lastValidBlockHeight } =
      await SolanaPlatform.latestBlock(this._rpc);

    for (const txn of tx) {
      const { description, transaction } = txn as SolanaUnsignedTransaction<
        N,
        C
      >;
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) {
        const st = transaction as Transaction;
        console.log(st.signatures);
        console.log(st.feePayer);
        st.instructions.forEach((ix) => {
          console.log('Program', ix.programId.toBase58());
          console.log('Data: ', ix.data.toString('hex'));
          console.log(
            'Keys: ',
            ix.keys.map((k) => [k, k.pubkey.toBase58()]),
          );
        });
      }

      transaction.partialSign(this._keypair);

      const txid = await this._rpc.sendRawTransaction(transaction.serialize(), {
        // skipPreflight: true,
        // preflightCommitment: this._rpc.commitment,
        maxRetries: 5,
      });

      console.log(`Sent: ${description} for ${this.address()}`);

      await this._rpc.confirmTransaction({
        signature: txid,
        blockhash,
        lastValidBlockHeight,
      });

      txids.push(txid);
    }

    return txids;
  }
}
