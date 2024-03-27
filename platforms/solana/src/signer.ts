import type {
  TransactionInstruction,
  Connection,
  SendOptions,
  Transaction,
} from '@solana/web3.js';
import {
  ComputeBudgetProgram,
  PublicKey,
  Keypair,
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
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
import type { SolanaUnsignedTransaction } from './unsignedTransaction.js';

// Add priority fee according to 90th percentile of recent fees paid
const DEFAULT_PRIORITY_FEE_PERCENTILE = 0.9;

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

// returns a SignAndSendSigner for the Solana platform
export async function getSolanaSignAndSendSigner(
  rpc: Connection,
  privateKey: string,
  opts?: {
    debug?: boolean;
    addPriorityFee?: boolean;
    sendOpts?: SendOptions;
  },
): Promise<Signer> {
  const [_, chain] = await SolanaPlatform.chainFromRpc(rpc);
  return new SolanaSendSigner(
    rpc,
    chain,
    Keypair.fromSecretKey(encoding.b58.decode(privateKey)),
    opts?.debug ?? false,
    opts?.addPriorityFee ?? false,
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

      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._debug) logTxDetails(transaction);

      transaction.recentBlockhash = blockhash;
      transaction.partialSign(this._keypair, ...(extraSigners ?? []));
      signed.push(transaction.serialize());
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
    private _addPriorityFee: boolean = false,
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
      console.log(`Signing: ${description} for ${this.address()}`);

      if (this._addPriorityFee) {
        transaction.add(...(await addComputeBudget(this._rpc, transaction)));
      }
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

export function logTxDetails(transaction: Transaction) {
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

export async function addComputeBudget(
  connection: Connection,
  transaction: Transaction,
  lockedWritableAccounts: PublicKey[] = [],
  feePercentile: number = DEFAULT_PRIORITY_FEE_PERCENTILE,
  minPriorityFee: number = 0,
): Promise<TransactionInstruction[]> {
  if (lockedWritableAccounts.length === 0) {
    lockedWritableAccounts = transaction.instructions
      .flatMap((ix) => ix.keys)
      .map((k) => (k.isWritable ? k.pubkey : null))
      .filter((k) => k !== null) as PublicKey[];
  }
  return await determineComputeBudget(
    connection,
    transaction,
    lockedWritableAccounts,
    feePercentile,
    minPriorityFee,
  );
}

export async function determineComputeBudget(
  connection: Connection,
  transaction: Transaction,
  lockedWritableAccounts: PublicKey[] = [],
  feePercentile: number = DEFAULT_PRIORITY_FEE_PERCENTILE,
  minPriorityFee: number = 0,
): Promise<TransactionInstruction[]> {
  let computeBudget = 250_000;
  let priorityFee = 1;

  try {
    const simulateResponse = await connection.simulateTransaction(transaction);

    if (simulateResponse.value.err) {
      console.error(
        `Error simulating Solana transaction: ${simulateResponse.value.err}`,
      );
    }

    if (simulateResponse?.value?.unitsConsumed) {
      // Set compute budget to 120% of the units used in the simulated transaction
      computeBudget = Math.round(simulateResponse.value.unitsConsumed * 1.2);
    }
  } catch (e) {
    console.error(
      `Failed to calculate compute unit limit for Solana transaction: ${e}`,
    );
  }

  try {
    priorityFee = await determinePriorityFee(
      connection,
      lockedWritableAccounts,
      feePercentile,
    );
  } catch (e) {
    console.error(
      `Failed to calculate compute unit price for Solana transaction: ${e}`,
    );
    return [];
  }
  priorityFee = Math.max(priorityFee, minPriorityFee);

  return [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeBudget,
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee,
    }),
  ];
}

async function determinePriorityFee(
  connection: Connection,
  lockedWritableAccounts: PublicKey[] = [],
  percentile: number,
): Promise<number> {
  // https://twitter.com/0xMert_/status/1768669928825962706

  let fee = 1; // Set fee to 1 microlamport by default

  try {
    const recentFeesResponse = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts,
    });

    if (recentFeesResponse) {
      // Get 75th percentile fee paid in recent slots
      const recentFees = recentFeesResponse
        .map((dp) => dp.prioritizationFee)
        .filter((dp) => dp > 0)
        .sort((a, b) => a - b);

      if (recentFees.length > 0) {
        const medianFee =
          recentFees[Math.floor(recentFees.length * percentile)];
        fee = Math.max(fee, medianFee!);
      }
    }
  } catch (e) {
    console.error('Error fetching Solana recent fees', e);
  }

  return fee;
}
