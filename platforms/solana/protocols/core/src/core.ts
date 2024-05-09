import type { Program } from '@coral-xyz/anchor';
import type {
  CompiledInstruction,
  Connection,
  MessageAccountKeys,
  MessageCompiledInstruction,
  PublicKey,
  TransactionResponse,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { Keypair, Transaction } from '@solana/web3.js';
import type {
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  UniversalAddress,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from '@wormhole-foundation/sdk-connect';
import {
  createVAA,
  toChain,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import type {
  AnySolanaAddress,
  SolanaChains,
  SolanaTransaction,
} from '@wormhole-foundation/sdk-solana';
import {
  SolanaAddress,
  SolanaPlatform,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/sdk-solana';
import { deserializePostMessage } from './postMessageLayout.js';
import type { Wormhole as WormholeCoreContract } from './types.js';
import type { BridgeData } from './utils/index.js';
import {
  createBridgeFeeTransferInstruction,
  createPostMessageInstruction,
  createPostVaaInstruction,
  createReadOnlyWormholeProgramInterface,
  createVerifySignaturesInstructions,
  derivePostedVaaKey,
  getGuardianSet,
  getWormholeBridgeData,
} from './utils/index.js';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

export class SolanaWormholeCore<N extends Network, C extends SolanaChains>
  implements WormholeCore<N, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: Program<WormholeCoreContract>;
  readonly address: string;
  protected bridgeData?: BridgeData;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Connection,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(
        `CoreBridge contract Address for chain ${chain} not found`,
      );

    this.address = coreBridgeAddress;

    this.coreBridge = createReadOnlyWormholeProgramInterface(
      coreBridgeAddress,
      connection,
    );
  }

  async getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    const gs = await getGuardianSet(
      this.connection,
      this.coreBridge.programId,
      index,
    );
    return {
      index: gs.index,
      keys: gs.keys.map((k) => k.toString('hex')),
      expiry: BigInt(gs.expirationTime),
    };
  }

  static async fromRpc<N extends Network>(
    connection: Connection,
    config: ChainsConfig<N, Platform>,
  ) {
    const [network, chain] = await SolanaPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(
        `Network mismatch for chain ${chain}: ${conf.network} != ${network}`,
      );

    return new SolanaWormholeCore(
      network as N,
      chain,
      connection,
      config[chain]!.contracts,
    );
  }

  private async ensureBridgeConfig() {
    // cache lookups since this should not change frequently
    if (!this.bridgeData)
      this.bridgeData = await getWormholeBridgeData(
        this.connection,
        this.coreBridge.programId,
      );
  }

  async getMessageFee(): Promise<bigint> {
    await this.ensureBridgeConfig();
    return this.bridgeData!.config.fee;
  }

  async getGuardianSetIndex(): Promise<number> {
    await this.ensureBridgeConfig();
    return this.bridgeData!.guardianSetIndex;
  }

  async *publishMessage(
    sender: AnySolanaAddress,
    message: Uint8Array,
    nonce: number,
    consistencyLevel: number,
  ) {
    const messageAccount = Keypair.generate();
    const payer = new SolanaAddress(sender).unwrap();
    const postMsgIx = createPostMessageInstruction(
      this.connection,
      this.coreBridge.programId,
      payer,
      messageAccount.publicKey,
      message,
      nonce,
      consistencyLevel,
    );

    const fee = await this.getMessageFee();
    const feeTransferIx = createBridgeFeeTransferInstruction(
      this.coreBridge.programId,
      payer,
      fee,
    );

    const transaction = new Transaction();
    transaction.feePayer = payer;
    transaction.add(feeTransferIx, postMsgIx);
    yield this.createUnsignedTx(
      { transaction, signers: [messageAccount] },
      'Core.PublishMessage',
    );
  }

  async *verifyMessage(sender: AnySolanaAddress, vaa: VAA) {
    yield* this.postVaa(sender, vaa);
  }

  async *postVaa(sender: AnySolanaAddress, vaa: VAA) {
    const postedVaaAddress = derivePostedVaaKey(
      this.coreBridge.programId,
      Buffer.from(vaa.hash),
    );

    // no need to do anything else, this vaa is posted
    const isPosted = await this.connection.getAccountInfo(postedVaaAddress);
    if (isPosted) return;

    const senderAddr = new SolanaAddress(sender).unwrap();
    const signatureSet = Keypair.generate();

    const verifySignaturesInstructions =
      await createVerifySignaturesInstructions(
        this.connection,
        this.coreBridge.programId,
        senderAddr,
        vaa,
        signatureSet.publicKey,
      );

    // Create a new transaction for every 2 instructions
    for (let i = 0; i < verifySignaturesInstructions.length; i += 2) {
      const verifySigTx = new Transaction().add(
        ...verifySignaturesInstructions.slice(i, i + 2),
      );
      verifySigTx.feePayer = senderAddr;
      yield this.createUnsignedTx(
        { transaction: verifySigTx, signers: [signatureSet] },
        'Core.VerifySignature',
        true,
      );
    }

    // Finally create the VAA posting transaction
    const postVaaTx = new Transaction().add(
      createPostVaaInstruction(
        this.connection,
        this.coreBridge.programId,
        senderAddr,
        vaa,
        signatureSet.publicKey,
      ),
    );
    postVaaTx.feePayer = senderAddr;

    yield this.createUnsignedTx({ transaction: postVaaTx }, 'Core.PostVAA');
  }

  static parseSequenceFromLog(
    coreBridgeAddress: string,
    transaction: VersionedTransactionResponse | TransactionResponse,
  ): [UniversalAddress, bigint][] {
    const {
      meta,
      transaction: { message },
    } = transaction;
    if (!meta?.innerInstructions?.length) return [];

    // Only consider transactions where the core bridge is in static keys
    const accounts = message.staticAccountKeys;
    if (
      accounts.filter((pk) => pk.toString() === coreBridgeAddress).length === 0
    )
      return [];

    // Do we have a sequence in the log?
    const sequence = meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');
    if (!sequence) return [];

    const bridgeIx: CompiledInstruction[] = [];
    for (const inner of meta?.innerInstructions) {
      const instructions = inner.instructions;
      // find the instruction where the programId equals the
      // Wormhole ProgramId
      bridgeIx.push(
        ...instructions.filter((i) => {
          return (
            i.programIdIndex in accounts &&
            accounts[i.programIdIndex]!.toString() === coreBridgeAddress
          );
        }),
      );
    }

    if (bridgeIx.length < 1) return [];
    if (accounts.length < 3) return [];

    return bridgeIx
      .map((ix) => {
        const emitter = new SolanaAddress(
          accounts[ix.accounts[2]!]!,
        ).toUniversalAddress();
        return [emitter, BigInt(sequence)];
      })
      .filter((x) => x !== null) as [UniversalAddress, bigint][];
  }

  private async getMessageAccountKeys(
    response: VersionedTransactionResponse,
  ): Promise<MessageAccountKeys> {
    // Resolve any LUT accounts if necessary
    let accounts: MessageAccountKeys;
    // a string type is indicative of a 'legacy' transaction
    if (typeof response.transaction.message.version !== 'string') {
      if (response.meta!.loadedAddresses) {
        accounts = response.transaction.message.getAccountKeys({
          accountKeysFromLookups: response.meta!.loadedAddresses,
        });
      } else {
        const atls = await Promise.all(
          response.transaction.message.addressTableLookups.map(async (atl) => {
            const lut = await this.connection.getAddressLookupTable(
              atl.accountKey,
            );

            if (!lut || !lut.value)
              throw new Error(
                'Could not resolve lookup table: ' + atl.accountKey.toBase58(),
              );

            return lut.value;
          }),
        );
        accounts = response.transaction.message.getAccountKeys({
          addressLookupTableAccounts: atls,
        });
      }
    } else {
      accounts = response.transaction.message.getAccountKeys();
    }
    return accounts;
  }

  private async findInstructions(
    accounts: MessageAccountKeys,
    response: VersionedTransactionResponse,
  ): Promise<MessageCompiledInstruction[]> {
    const {
      meta,
      transaction: { message },
    } = response;

    const programId = this.coreBridge.programId;

    const iix = meta!.innerInstructions
      ?.flatMap((ix) =>
        ix.instructions.filter(
          // find the instructions where the programId equals the Wormhole ProgramId
          (i) =>
            programId.toString() === accounts.get(i.programIdIndex)!.toString(),
        ),
      )
      .map((ix) => {
        // map over inner ixs to put it in the same format as the compiled instructions
        // from the message
        return {
          programIdIndex: ix.programIdIndex,
          accountKeyIndexes: ix.accounts,
        };
      }) as MessageCompiledInstruction[];

    const cix = message.compiledInstructions.filter(
      (i) =>
        programId.toString() === accounts.get(i.programIdIndex)!.toString(),
    );

    // find the instruction where the programId equals the Wormhole ProgramId
    return [...iix, ...cix];
  }

  async parsePostMessageAccount(messageAccount: PublicKey) {
    const acctInfo = await this.connection.getAccountInfo(messageAccount);
    if (!acctInfo?.data) throw new Error('No data found in message account');

    const {
      timestamp,
      emitterAddress,
      emitterChain,
      consistencyLevel,
      sequence,
      nonce,
      payload,
    } = deserializePostMessage(new Uint8Array(acctInfo?.data!));

    return createVAA('Uint8Array', {
      guardianSet: await this.getGuardianSetIndex(),
      emitterChain: toChain(emitterChain),
      timestamp,
      emitterAddress,
      consistencyLevel,
      sequence,
      nonce,
      payload,
      signatures: [],
    });
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const response: VersionedTransactionResponse | null =
      await this.connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

    if (!response || !response.meta || !response.meta.innerInstructions)
      throw new Error('transaction not found');

    try {
      // The sequence is frequently found in the log, pull from there if we can
      const loggedSeqs = SolanaWormholeCore.parseSequenceFromLog(
        this.coreBridge.programId.toBase58(),
        response,
      );
      if (loggedSeqs.length > 0) {
        const [emitter, seq] = loggedSeqs[0]!;
        return [
          {
            chain: this.chain,
            emitter: emitter,
            sequence: seq,
          },
        ];
      }
    } catch {
      // but since  the account keys may need to be resolved, it could fail
    }

    const accounts = await this.getMessageAccountKeys(response);

    // Otherwise we need to get it from the message account
    const bridgeInstructions = await this.findInstructions(accounts, response);

    if (!bridgeInstructions || bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    const messagePromises = bridgeInstructions.map(async (bi) => {
      const messageAcct = accounts.get(bi.accountKeyIndexes[1]!);

      const vaa = await this.parsePostMessageAccount(messageAcct!);
      return {
        chain: vaa.emitterChain,
        emitter: vaa.emitterAddress,
        sequence: vaa.sequence,
      };
    });

    return await Promise.all(messagePromises);
  }

  async parseMessages(txid: string) {
    const response: VersionedTransactionResponse | null =
      await this.connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

    if (!response || !response.meta || !response.meta.innerInstructions)
      throw new Error('transaction not found');

    // Otherwise we need to get it from the message account
    const accounts = await this.getMessageAccountKeys(response);
    const bridgeInstructions = await this.findInstructions(accounts, response);

    if (!bridgeInstructions || bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    const messagePromises = bridgeInstructions.map(async (bi) => {
      const messageAcct = accounts.get(bi.accountKeyIndexes[1]!);
      return await this.parsePostMessageAccount(messageAcct!);
    });

    return await Promise.all(messagePromises);
  }

  private createUnsignedTx(
    txReq: SolanaTransaction,
    description: string,
    parallelizable: boolean = false,
  ): SolanaUnsignedTransaction<N, C> {
    return new SolanaUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
