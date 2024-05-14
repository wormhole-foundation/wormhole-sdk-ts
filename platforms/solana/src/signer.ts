import type {
  Connection,
  SendOptions,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
  TransactionMessage,
} from '@solana/web3.js';
import type {
  Network,
  SignAndSendSigner,
  SignOnlySigner,
  Signer,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk-connect';
import { encoding } from '@wormhole-foundation/sdk-connect';
import { SolanaPlatform } from './platform.js';
import type { SolanaChains } from './types.js';
import {
  isVersionedTransaction,
  type SolanaUnsignedTransaction,
} from './unsignedTransaction.js';

const DEFAULT_PRIORITY_FEE_PERCENTILE = 0.9;
const DEFAULT_MAX_RESUBMITS = 5;
const DEFAULT_COMPUTE_BUDGET = 250_000;
const DEFAULT_MIN_PRIORITY_FEE = 1;
const DEFAULT_MAX_PRIORITY_FEE = 1e9;

// returns a SignOnlySigner for the Solana platform
export async function getSolanaSigner(
  rpc: Connection,
  privateKey: string,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSigner(
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
    rpc,
  );
}
export type PriorityFeeSettings = {
  percentile?: number;
  percentileMultiple?: number;
  max?: number;
  min?: number;
};

export type SolanaSendSignerOpts = {
  debug?: boolean;
  priorityFee?: PriorityFeeSettings;
  sendOpts?: SendOptions;
  retries?: number;
};

// returns a SignAndSendSigner for the Solana platform
export async function getSolanaSignAndSendSigner(
  rpc: Connection,
  privateKey: string | Keypair,
  opts?: SolanaSendSignerOpts,
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);

  const kp =
    typeof privateKey === 'string'
      ? Keypair.fromSecretKey(encoding.b58.decode(privateKey))
      : privateKey;

  if (opts?.priorityFee) {
    if (opts.priorityFee.percentile && opts.priorityFee.percentile > 1.0)
      throw new Error('priorityFeePercentile must be a number between 0 and 1');
    // TODO: other validation
  }

  return new SolanaSendSigner(
    rpc,
    chain,
    kp,
    opts?.debug ?? false,
    opts?.priorityFee ?? {},
    opts?.retries ?? DEFAULT_MAX_RESUBMITS,
    opts?.sendOpts,
  );
}

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

  async sign(tx: SolanaUnsignedTransaction<N>[]): Promise<Buffer[]> {
    const { blockhash } = await SolanaPlatform.latestBlock(this._rpc);

    const signed = [];
    for (const txn of tx) {
      const {
        description,
        transaction: { transaction, signers: extraSigners },
      } = txn;

      if (this._debug)
        console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) logTxDetails(transaction);

      if (isVersionedTransaction(transaction)) {
        transaction.message.recentBlockhash = blockhash;
        transaction.sign([this._keypair, ...(extraSigners ?? [])]);
        signed.push(Buffer.from(transaction.serialize()));
      } else {
        transaction.recentBlockhash = blockhash;
        transaction.partialSign(this._keypair, ...(extraSigners ?? []));
        signed.push(transaction.serialize());
      }
    }
    return signed;
  }
}

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
    private _priorityFee: PriorityFeeSettings,
    private _maxResubmits: number = DEFAULT_MAX_RESUBMITS,
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

      if (this._debug)
        console.log(`Signing: ${description} for ${this.address()}`);

      let priorityFeeIx: TransactionInstruction[] | undefined;
      if (this._priorityFee?.percentile && this._priorityFee.percentile > 0)
        priorityFeeIx = await createPriorityFeeInstructions(
          this._rpc,
          transaction,
          this._priorityFee.percentile,
          this._priorityFee.percentileMultiple,
          this._priorityFee.min,
          this._priorityFee.max,
        );

      if (this._debug) logTxDetails(transaction);

      // Try to send the transaction up to 5 times
      for (let i = 0; i < this._maxResubmits; i++) {
        try {
          if (isVersionedTransaction(transaction)) {
            if (priorityFeeIx) {
              const msg = TransactionMessage.decompile(transaction.message);
              msg.instructions.push(...priorityFeeIx);
              transaction.message = msg.compileToV0Message();
            }
            transaction.message.recentBlockhash = blockhash;
            transaction.sign([this._keypair, ...(extraSigners ?? [])]);
          } else {
            if (priorityFeeIx) transaction.add(...priorityFeeIx);
            transaction.recentBlockhash = blockhash;
            transaction.partialSign(this._keypair, ...(extraSigners ?? []));
          }

          const txid = await this._rpc.sendRawTransaction(
            transaction.serialize(),
            this._sendOpts,
          );
          txids.push(txid);
          break;
        } catch (e) {
          // No point checking if retryable if we're on the last retry
          if (i === this._maxResubmits - 1) throw e;

          // If it's not retryable, throw
          if (!this.retryable(e)) throw e;

          // If it is retryable, we need to grab a new block hash
          const {
            blockhash: newBlockhash,
            lastValidBlockHeight: newBlockHeight,
          } = await SolanaPlatform.latestBlock(this._rpc);

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

export function logTxDetails(transaction: Transaction | VersionedTransaction) {
  if (isVersionedTransaction(transaction)) {
    console.log(transaction.signatures);
    const msg = transaction.message;
    const keys = msg.getAccountKeys();
    msg.compiledInstructions.forEach((ix) => {
      console.log('Program', keys.get(ix.programIdIndex)!.toBase58());
      console.log('Data: ', encoding.hex.encode(ix.data));
      console.log(
        'Keys: ',
        ix.accountKeyIndexes.map((k) => [k, keys.get(k)!.toBase58()]),
      );
    });
  } else {
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
}

export async function createPriorityFeeInstructions(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  feePercentile: number = DEFAULT_PRIORITY_FEE_PERCENTILE,
  multiple: number = 0,
  minPriorityFee: number = DEFAULT_MIN_PRIORITY_FEE,
  maxPriorityFee: number = DEFAULT_MAX_PRIORITY_FEE,
): Promise<TransactionInstruction[]> {
  const [computeBudget, priorityFee] = await Promise.all([
    determineComputeBudget(connection, transaction),
    determinePriorityFee(
      connection,
      transaction,
      feePercentile,
      multiple,
      minPriorityFee,
      maxPriorityFee,
    ),
  ]);

  return [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeBudget,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee,
    }),
  ];
}

export async function determineComputeBudget(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
): Promise<number> {
  let computeBudget = DEFAULT_COMPUTE_BUDGET;
  try {
    const simulateResponse = await (isVersionedTransaction(transaction)
      ? connection.simulateTransaction(transaction)
      : connection.simulateTransaction(transaction));

    if (simulateResponse.value.err)
      console.error(
        `Error simulating Solana transaction: ${simulateResponse.value.err}`,
      );

    if (simulateResponse?.value?.unitsConsumed) {
      // Set compute budget to 120% of the units used in the simulated transaction
      computeBudget = Math.round(simulateResponse.value.unitsConsumed * 1.2);
    }
  } catch (e) {
    console.error(
      `Failed to calculate compute unit limit for Solana transaction: ${e}`,
    );
  }
  return computeBudget;
}

/**
 * A helper function to determine the priority fee to use for a transaction
 *
 * @param connection Solana/web3.js Connection to the network
 * @param transaction The transaction to determine the priority fee for
 * @param percentile The percentile of recent fees to use
 * @param multiple The multiple to apply to the percentile fee
 * @param minPriorityFee The minimum priority fee to use
 * @param maxPriorityFee The maximum priority fee to use
 * @returns the priority fee to use according to the recent transactions and the given parameters
 */
export async function determinePriorityFee(
  connection: Connection,
  transaction: Transaction | VersionedTransaction,
  percentile: number,
  multiple: number = 0,
  minPriorityFee: number = DEFAULT_MIN_PRIORITY_FEE,
  maxPriorityFee: number = DEFAULT_MAX_PRIORITY_FEE,
): Promise<number> {
  // https://twitter.com/0xMert_/status/1768669928825962706

  // Start with min fee
  let fee = minPriorityFee;

  // Figure out which accounts need write lock
  let lockedWritableAccounts = [];
  if (isVersionedTransaction(transaction)) {
    const msg = transaction.message;
    const keys = msg.getAccountKeys();
    lockedWritableAccounts = msg.compiledInstructions
      .flatMap((ix) => ix.accountKeyIndexes)
      .map((k) => (msg.isAccountWritable(k) ? keys.get(k) : null))
      .filter((k) => k !== null) as PublicKey[];
  } else {
    lockedWritableAccounts = transaction.instructions
      .flatMap((ix) => ix.keys)
      .map((k) => (k.isWritable ? k.pubkey : null))
      .filter((k) => k !== null) as PublicKey[];
  }

  try {
    const recentFeesResponse = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts,
    });

    if (recentFeesResponse) {
      // Sort fees to find the appropriate percentile
      const recentFees = recentFeesResponse
        .map((dp) => dp.prioritizationFee)
        .sort((a, b) => a - b);

      // Find the element in the distribution that matches the percentile requested
      const idx = Math.ceil(recentFees.length * percentile);
      if (recentFees.length > idx) {
        let percentileFee = recentFees[idx]!;

        // Apply multiple if provided
        if (multiple > 0) percentileFee *= multiple;

        fee = Math.max(fee, percentileFee);
      }
    }
  } catch (e) {
    console.error('Error fetching Solana recent fees', e);
  }

  // Bound the return value by the parameters pased
  return Math.min(Math.max(fee, minPriorityFee), maxPriorityFee);
}
