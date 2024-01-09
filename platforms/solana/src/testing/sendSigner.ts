import {
  ComputeBudgetProgram,
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

// Number of blocks to wait before considering a transaction expired
const SOLANA_EXPIRED_BLOCKHEIGHT = 150;

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
    private _priotifyFeeAmount?: bigint,
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
  // - Transaction expired
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
    const loggedErr = e.logs?.find((log) =>
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
    );

    const txids: string[] = [];
    for (const txn of tx) {
      const {
        description,
        transaction: { transaction, signers: extraSigners },
      } = txn as SolanaUnsignedTransaction<N, C>;
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._priotifyFeeAmount)
        transaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: this._priotifyFeeAmount,
          }),
        );

      if (this._debug) logTxDetails(transaction);

      // Try to send the transaction up to 5 times
      const maxRetries = 5;
      for (let i = 0; i < maxRetries; i++) {
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
          // No point checking if retryable if we're on the last retry
          if (i === maxRetries - 1) throw e;

          // If it's not retryable, throw
          if (!this.retryable(e)) throw e;

          // If it is retryable, we need to grab a new block hash
          const {
            blockhash: newBlockhash,
            lastValidBlockHeight: newBlockHeight,
          } = await SolanaPlatform.latestBlock(this._rpc);

          // But we should _not_ submit if the blockhash hasnt expired
          if (
            newBlockHeight - lastValidBlockHeight <
            SOLANA_EXPIRED_BLOCKHEIGHT
          ) {
            throw e;
          }

          lastValidBlockHeight = newBlockHeight;
          blockhash = newBlockhash;
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
