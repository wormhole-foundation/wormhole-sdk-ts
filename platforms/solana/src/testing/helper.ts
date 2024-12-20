// Solana
import {
  AccountInfo,
  Connection,
  Finality,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import * as spl from '@solana/spl-token';
// Node
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
// Wormhole
import { extractPubkey, HasPublicKey } from './index.js';
import { UniversalAddress } from '../../../../core/definitions/src/universalAddress.js';
import { Network } from '@wormhole-foundation/sdk-base';
import { Contracts } from '@wormhole-foundation/sdk-definitions';
import { TestingWormholeCore } from './client/wormhole-core.js';
import { TestingTokenBridge } from './client/token-bridge.js';

const execAsync = promisify(exec);

type Tuple<T, N extends number, R extends T[] = []> = R['length'] extends N
  ? R
  : Tuple<T, N, [T, ...R]>;

/**
 * A helper to be used for Solana integration tests (Node environment).
 *
 * It is recomended to create one instance with a short name, allowing to chain calls easily:
 *
 * ```ts
 * const h = new TestsHelper();
 * const [keypair1, keypair2] = await h.airdrop(h.keypair.several(2));
 * ```
 */
export class TestsHelper {
  static readonly LOCALHOST = 'http://localhost:8899';

  readonly connection: Connection;
  readonly finality: Finality;

  private static readonly connectionsCache: Partial<
    Record<Finality, Connection>
  > = {};

  constructor(finality: Finality = 'confirmed') {
    if (TestsHelper.connectionsCache[finality] === undefined) {
      TestsHelper.connectionsCache[finality] = new Connection(
        TestsHelper.LOCALHOST,
        finality,
      );
    }
    this.connection = TestsHelper.connectionsCache[finality];
    this.finality = finality;
  }

  pubkey = {
    generate: (): PublicKey => PublicKey.unique(),
    read: async (path: string): Promise<PublicKey> =>
      this.keypair.read(path).then((kp) => kp.publicKey),
    from: (hasPublicKey: HasPublicKey): PublicKey =>
      extractPubkey(hasPublicKey),
    several: <N extends number>(amount: number): Tuple<PublicKey, N> =>
      Array.from({ length: amount }).map(PublicKey.unique) as Tuple<
        PublicKey,
        N
      >,
  };

  keypair = {
    generate: (): Keypair => Keypair.generate(),
    read: async (path: string): Promise<Keypair> =>
      this.keypair.from(
        JSON.parse(await fs.readFile(path, { encoding: 'utf8' })),
      ),
    from: (bytes: number[]): Keypair =>
      Keypair.fromSecretKey(Uint8Array.from(bytes)),
    several: <N extends number>(amount: N): Tuple<Keypair, N> =>
      Array.from({ length: amount }).map(Keypair.generate) as Tuple<Keypair, N>,
  };

  universalAddress = {
    generate: (ethereum?: 'ethereum'): UniversalAddress =>
      ethereum === 'ethereum'
        ? new UniversalAddress(
            Buffer.concat([
              Buffer.alloc(12),
              PublicKey.unique().toBuffer().subarray(12),
            ]),
          )
        : new UniversalAddress(PublicKey.unique().toBuffer()),
    several: <N extends number>(
      amount: number,
      ethereum?: 'ethereum',
    ): Tuple<UniversalAddress, N> =>
      Array.from({ length: amount }).map(() =>
        this.universalAddress.generate(ethereum),
      ) as Tuple<UniversalAddress, N>,
  };

  /** Gets the transaction detail from a transaction signature. */
  async getTransaction(
    signature: TransactionSignature | Promise<TransactionSignature>,
  ): Promise<VersionedTransactionResponse | null> {
    return this.connection.getTransaction(await signature, {
      commitment: this.finality,
      maxSupportedTransactionVersion: 1,
    });
  }

  async getBlockTime(): Promise<number> {
    return getBlockTime(this.connection);
  }

  /** Waits that a transaction is confirmed. */
  async confirm(signature: TransactionSignature) {
    const latestBlockHash = await this.connection.getLatestBlockhash();

    return this.connection.confirmTransaction({
      signature,
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    });
  }

  /** Sends a transaction, then wait that it is confirmed. */
  async sendAndConfirm(
    ixs: TransactionInstruction | Transaction | Array<TransactionInstruction>,
    payer: Signer,
    ...signers: Signer[]
  ): Promise<TransactionSignature> {
    return sendAndConfirm(this.connection, ixs, payer, ...signers);
  }

  /** Airdrops lamports to an account or several ones. */
  async airdrop<T extends HasPublicKey | ArrayLike<HasPublicKey>>(
    to: T,
    lamports: number = 50 * LAMPORTS_PER_SOL,
  ): Promise<T> {
    function isArrayLikePubkey(
      o: HasPublicKey | ArrayLike<HasPublicKey>,
    ): o is ArrayLike<HasPublicKey> {
      return (
        o != null &&
        isArrayLike(o) &&
        Array.from<number | HasPublicKey>(o).every(
          (value) => typeof value !== 'number',
        )
      );
    }

    const request = async (account: PublicKey) =>
      this.confirm(await this.connection.requestAirdrop(account, lamports));

    if (isArrayLikePubkey(to)) {
      await Promise.all(
        Array.from(to).map((account) => request(extractPubkey(account))),
      );
    } else {
      await request(extractPubkey(to));
    }

    return to;
  }

  /** Deploys a new program. */
  async deploy(paths: {
    programKeypair: string;
    authorityKeypair: string;
    binary: string;
  }) {
    const { programKeypair, authorityKeypair, binary } = paths;
    const BpfProgramId = new PublicKey(
      'BPFLoaderUpgradeab1e11111111111111111111111',
    );

    // Deploy:
    await execAsync(
      `solana --url ${TestsHelper.LOCALHOST} -k ${authorityKeypair} program deploy ${binary} --program-id ${programKeypair}`,
    );

    // Wait for deploy to be finalized (otherwise there can be a problem where the
    // function returns, but calling a program method fails):
    const programId = await this.pubkey.read(programKeypair);
    const programDataAddress = PublicKey.findProgramAddressSync(
      [programId.toBuffer()],
      BpfProgramId,
    )[0];
    let programAccount: AccountInfo<Buffer> | null = null;
    while (programAccount === null) {
      programAccount = await this.connection.getAccountInfo(
        programDataAddress,
        'finalized',
      );
    }
  }

  // SPL

  /**
   * Creates a new token account and transfers wrapped SOL to it.
   * If none is provided, a new keypair is generated.
   */
  async wrapSol(
    signer: Signer,
    amount: number,
    tokenAccount: Keypair = Keypair.generate(),
  ): Promise<Keypair> {
    const tx = new Transaction().add(
      // Allocate account:
      SystemProgram.createAccount({
        fromPubkey: signer.publicKey,
        newAccountPubkey: tokenAccount.publicKey,
        space: spl.ACCOUNT_SIZE,
        lamports: await spl.getMinimumBalanceForRentExemptAccount(
          this.connection,
        ),
        programId: spl.TOKEN_PROGRAM_ID,
      }),
      // Initialize token account:
      spl.createInitializeAccountInstruction(
        tokenAccount.publicKey,
        spl.NATIVE_MINT,
        signer.publicKey,
      ),
      // Transfer SOL:
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: tokenAccount.publicKey,
        lamports: amount,
      }),
      // Move the lamports as wSOL:
      spl.createSyncNativeInstruction(tokenAccount.publicKey),
    );

    await this.sendAndConfirm(tx, signer, tokenAccount);

    return tokenAccount;
  }

  /** Creates a new mint, and returns an object allowing to run common operations against it. */
  createMint(authority: Signer, decimals: number): Promise<TestsMint> {
    return TestsMint.create(this.connection, authority, decimals);
  }

  createCoreClient<N extends Network>(
    connection: Connection,
    defaultSigner: Signer,
    network: N,
    contracts: Contracts,
  ): TestingWormholeCore<N> {
    return new TestingWormholeCore(
      connection,
      defaultSigner,
      network,
      contracts,
    );
  }

  /**
   *
   * @param solanaProgram The Solana Program used as a destination for the VAAs, _i.e._ the program being tested.
   * @param contracts At least the addresses `coreBridge` and `tokenBridge` must be provided.
   */
  createTokenBridgeClient<N extends Network>(
    connection: Connection,
    defaultSigner: Signer,
    network: N,
    contracts: Contracts,
    solanaProgram: PublicKey,
  ): TestingTokenBridge<N> {
    return new TestingTokenBridge(
      connection,
      defaultSigner,
      network,
      contracts,
      this.createCoreClient(connection, defaultSigner, network, contracts),
      solanaProgram,
    );
  }
}

export async function getBlockTime(connection: Connection): Promise<number> {
  // This should never fail.
  return connection
    .getSlot()
    .then(async (slot) => connection.getBlockTime(slot))
    .then((value) => value ?? 0);
}

/** Sends a transaction, then wait that it is confirmed. */
export async function sendAndConfirm(
  connection: Connection,
  ixs: TransactionInstruction | Transaction | Array<TransactionInstruction>,
  payer: Signer,
  ...signers: Signer[]
): Promise<TransactionSignature> {
  const { value } = await connection.getLatestBlockhashAndContext();
  const tx = new Transaction({
    ...value,
    feePayer: payer.publicKey,
  }).add(...(Array.isArray(ixs) ? ixs : [ixs]));

  return sendAndConfirmTransaction(connection, tx, [payer, ...signers], {});
}

export class TestsMint {
  readonly connection: Connection;
  readonly address: PublicKey;
  readonly authority: Signer;
  readonly decimals: number;

  private constructor(
    connection: Connection,
    authority: Signer,
    address: PublicKey,
    decimals: number,
  ) {
    this.authority = authority;
    this.connection = connection;
    this.address = address;
    this.decimals = decimals;
  }

  static async create(
    connection: Connection,
    authority: Signer,
    decimals: number,
  ): Promise<TestsMint> {
    return new TestsMint(
      connection,
      authority,
      await spl.createMint(
        connection,
        authority,
        authority.publicKey,
        authority.publicKey,
        decimals,
      ),
      decimals,
    );
  }

  /**
   * Mints new tokens to the token account (if none is provided, a new one is generated).
   * Returns the token account keypair.
   */
  async mint(
    amount: number | bigint,
    accountAuthority: Signer,
    tokenAccount: Keypair = Keypair.generate(),
  ): Promise<Keypair> {
    const tx = new Transaction().add(
      // Allocate account:
      SystemProgram.createAccount({
        fromPubkey: accountAuthority.publicKey,
        newAccountPubkey: tokenAccount.publicKey,
        space: spl.ACCOUNT_SIZE,
        lamports: await spl.getMinimumBalanceForRentExemptAccount(
          this.connection,
        ),
        programId: spl.TOKEN_PROGRAM_ID,
      }),

      // Initialize token account:
      spl.createInitializeAccountInstruction(
        tokenAccount.publicKey,
        this.address,
        accountAuthority.publicKey,
      ),

      // Mint the tokens to the newly created account:
      spl.createMintToCheckedInstruction(
        this.address,
        tokenAccount.publicKey,
        this.authority.publicKey,
        amount,
        this.decimals,
      ),
    );

    await sendAndConfirm(
      this.connection,
      tx,
      accountAuthority,
      this.authority,
      tokenAccount,
    );

    return tokenAccount;
  }
}

// PRIVATE HELPERS:

function isArrayLike(o: any): o is ArrayLike<unknown> {
  return o != null && typeof o[Symbol.iterator] === 'function';
}
