import { Connection, Keypair } from '@solana/web3.js';
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
    const { blockhash, lastValidBlockHeight } =
      await SolanaPlatform.latestBlock(this._rpc, 'finalized');

    const txPromises: Promise<string>[] = [];

    for (const txn of tx) {
      const { description, transaction } = txn as SolanaUnsignedTransaction<
        N,
        C
      >;
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) {
        console.log(transaction.signatures);
        console.log(transaction.feePayer);
        transaction.instructions.forEach((ix) => {
          console.log('Program', ix.programId.toBase58());
          console.log('Data: ', ix.data.toString('hex'));
          console.log(
            'Keys: ',
            ix.keys.map((k) => [k, k.pubkey.toBase58()]),
          );
        });
      }

      transaction.partialSign(this._keypair);

      txPromises.push(
        this._rpc.sendRawTransaction(transaction.serialize(), {
          preflightCommitment: this._rpc.commitment,
        }),
      );
    }
    const txids = await Promise.all(txPromises);

    // Wait for finalization
    for (const signature of txids) {
      await this._rpc.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });
    }

    return txids;
  }
}
