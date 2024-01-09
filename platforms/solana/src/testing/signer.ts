import { Connection, Keypair } from '@solana/web3.js';
import {
  SignOnlySigner,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Network } from '@wormhole-foundation/sdk-base/src';
import { SolanaPlatform } from '../platform';
import { SolanaChains } from '../types';
import { logTxDetails } from './debug';

export class SolanaSigner<N extends Network, C extends SolanaChains = 'Solana'>
  implements SignOnlySigner<N, C>
{
  constructor(
    private _chain: C,
    private _keypair: Keypair,
    private _rpc: Connection,
    private _debug: boolean = false,
  ) {}

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._keypair.publicKey.toBase58();
  }

  async sign(tx: UnsignedTransaction[]): Promise<any[]> {
    const { blockhash } = await SolanaPlatform.latestBlock(this._rpc);

    const signed = [];
    for (const txn of tx) {
      const {
        description,
        transaction: { transaction, signers: extraSigners },
      } = txn;

      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) logTxDetails(transaction);

      transaction.recentBlockhash = blockhash;
      transaction.partialSign(this._keypair, ...(extraSigners ?? []));
      signed.push(transaction.serialize());
    }
    return signed;
  }
}
