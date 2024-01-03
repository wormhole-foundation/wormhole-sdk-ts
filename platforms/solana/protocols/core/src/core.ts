import { Program } from '@project-serum/anchor';
import {
  Connection,
  Keypair,
  MessageAccountKeys,
  MessageCompiledInstruction,
  Transaction,
  TransactionResponse,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import {
  SolanaAddress,
  AnySolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaUnsignedTransaction,
  SolanaTransaction,
} from '@wormhole-foundation/connect-sdk-solana';
import {
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  UniversalAddress,
  VAA,
  WormholeCore,
  WormholeMessageId,
  toChainId,
} from '@wormhole-foundation/connect-sdk';
import { Wormhole as WormholeCoreContract } from './types';
import {
  createPostMessageInstruction,
  createPostVaaInstruction,
  createReadOnlyWormholeProgramInterface,
  createVerifySignaturesInstructions,
  createBridgeFeeTransferInstruction,
  derivePostedVaaKey,
  getWormholeBridgeData,
  BridgeData,
} from './utils';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

export class SolanaWormholeCore<N extends Network, C extends SolanaChains>
  implements WormholeCore<N, SolanaPlatformType, C>
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

  async getMessageFee(): Promise<bigint> {
    // cache lookups since this should not change frequently
    if (!this.bridgeData)
      this.bridgeData = await getWormholeBridgeData(
        this.connection,
        this.coreBridge.programId,
      );

    return this.bridgeData.config.fee;
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
  ): [UniversalAddress, bigint] | null {
    if (!transaction || !transaction.meta?.innerInstructions![0]?.instructions)
      return null;

    const instructions = transaction.meta?.innerInstructions![0].instructions;
    const accounts = transaction.transaction.message.staticAccountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeIx = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex]!.toString();
      return programId === coreBridgeAddress;
    });

    if (bridgeIx.length < 1) return null;
    if (accounts.length < 3) return null;

    const emitter = new SolanaAddress(
      accounts[bridgeIx[0]!.accounts[2]!]!,
    ).toUniversalAddress();
    const sequence = transaction.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');

    if (!sequence) return null;

    return [emitter, BigInt(sequence)];
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const response: VersionedTransactionResponse | null =
      await this.connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

    if (!response || !response.meta || !response.meta.innerInstructions)
      throw new Error('transaction not found');

    // The sequence is frequently found in the log, pull from there if we can
    const loggedSeq = SolanaWormholeCore.parseSequenceFromLog(
      this.coreBridge.programId.toBase58(),
      response,
    );
    if (loggedSeq)
      return [
        {
          chain: this.chain,
          emitter: loggedSeq[0],
          sequence: loggedSeq[1],
        },
      ];

    // Otherwise we need to get it from the message account

    // Resolve any LUT accounts if necessary
    let accounts: MessageAccountKeys;
    // a string type is indicative of a 'legacy' transaction
    if (typeof response.transaction.message.version !== 'string') {
      if (response.meta.loadedAddresses) {
        accounts = response.transaction.message.getAccountKeys({
          accountKeysFromLookups: response.meta.loadedAddresses,
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

    // find the instruction where the programId equals the Wormhole ProgramId
    const iix = response.meta.innerInstructions[0]!.instructions.filter((i) => {
      const programId = accounts.get(i.programIdIndex)!.toString();
      const wormholeCore = this.coreBridge.programId.toString();
      return programId === wormholeCore;
    }).map((ix) => {
      // map over inner ixs to put it in the same format as the compiled instructions
      // from the message
      return {
        programIdIndex: ix.programIdIndex,
        accountKeyIndexes: ix.accounts,
      } as MessageCompiledInstruction;
    });

    const cix = response.transaction.message.compiledInstructions.filter(
      (i) => {
        const programId = accounts.get(i.programIdIndex)!.toString();
        const wormholeCore = this.coreBridge.programId.toString();
        return programId === wormholeCore;
      },
    );

    // find the instruction where the programId equals the Wormhole ProgramId
    const bridgeInstructions = [...iix, ...cix];
    if (!bridgeInstructions || bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    const messagePromises = bridgeInstructions.map(async (bi) => {
      const messageAcct = accounts.get(bi.accountKeyIndexes[1]!);

      const acctInfo = await this.connection.getAccountInfo(messageAcct!);
      const sequence = acctInfo!.data.readBigUInt64LE(49);

      const emitterAddr = new Uint8Array(acctInfo!.data.subarray(59, 91));
      const emitter = new SolanaAddress(emitterAddr);

      return {
        chain: this.chain,
        emitter: emitter.toUniversalAddress(),
        sequence: BigInt(sequence),
      };
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
