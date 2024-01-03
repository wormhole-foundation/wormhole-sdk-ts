import {
  Connection,
  Keypair,
  SendOptions,
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
} from '@solana/web3.js';
import {
  SignAndSendSigner,
  UnsignedTransaction,
} from '@wormhole-foundation/connect-sdk';
import { Network } from '@wormhole-foundation/sdk-base/src';
import { SolanaPlatform } from '../platform';
import { SolanaChains } from '../types';
import { SolanaUnsignedTransaction } from '../unsignedTransaction';
import { logTxDetails } from './debug';

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
    private _sendOpts?: SendOptions,
  ) {
    this._sendOpts = this._sendOpts ?? {
      preflightCommitment: this._rpc.commitment,
    };
  }

  chain(): C {
    return this._chain;
  }

  address(): string {
    return this._keypair.publicKey.toBase58();
  }

  // Handles retrying a Transaction if the error is deemed to be
  // recoverable. Currently handles:
  // - Blockhash not found
  // - Not enough bytes (storage account not seen yet)
  private retryable(e: any): boolean {
    // Tx expired, set a new block hash and retry
    if (e instanceof TransactionExpiredBlockheightExceededError) return true;

    // Besides tx expiry, only handle SendTransactionError
    if (!(e instanceof SendTransactionError)) return false;

    // Only handle simulation errors
    if (!e.message.includes('Transaction simulation failed')) return false;

    // Blockhash not found, similar to expired, resend with new blockhash
    if (e.message.includes('Blockhash not found')) return true;

    // Find the log message with the error details
    const loggedErr = e.logs.find((log) =>
      log.startsWith('Program log: Error: '),
    );

    // who knows
    if (!loggedErr) return false;

    // Probably caused by storage account not seen yet
    if (loggedErr.includes('Not enough bytes')) return true;
    if (loggedErr.includes('Unexpected length of input')) return true;

    return false;
  }

  async signAndSend(tx: UnsignedTransaction[]): Promise<any[]> {
    let { blockhash, lastValidBlockHeight } = await SolanaPlatform.latestBlock(
      this._rpc,
      'finalized',
    );

    const txids: string[] = [];
    for (const txn of tx) {
      const {
        description,
        transaction: { transaction, signers: extraSigners },
      } = txn as SolanaUnsignedTransaction<N, C>;
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) logTxDetails(transaction);

      // Try to send the transaction up to 5 times
      for (let i = 0; i < 5; i++) {
        try {
          transaction.recentBlockhash = blockhash;
          transaction.partialSign(this._keypair, ...(extraSigners ?? []));

          const txid = await this._rpc.sendRawTransaction(
            transaction.serialize(),
            this._sendOpts,
          );
          txids.push(txid);
          break;
        } catch (e) {
          if (!this.retryable(e)) throw e;

          // If it is retryable, we should grab a new block hash
          ({ blockhash, lastValidBlockHeight } =
            await SolanaPlatform.latestBlock(this._rpc, 'finalized'));
        }
      }
    }

    // Wait for finalization
    const results = await Promise.all(
      txids.map((signature) =>
        this._rpc.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          this._rpc.commitment,
        ),
      ),
    );

    const erroredTxs = results
      .filter((result) => result.value.err)
      .map((result) => result.value.err);

    if (erroredTxs.length > 0)
      throw new Error(`Failed to confirm transaction: ${erroredTxs}`);

    return txids;
  }
}
