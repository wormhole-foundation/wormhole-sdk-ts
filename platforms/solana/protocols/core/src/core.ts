import { Program } from '@project-serum/anchor';
import {
  Connection,
  Keypair,
  MessageAccountKeys,
  MessageCompiledInstruction,
  PublicKey,
  Transaction,
  TransactionResponse,
  VersionedTransactionResponse,
} from '@solana/web3.js';
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
  createVAA,
  toChainId,
} from '@wormhole-foundation/connect-sdk';
import {
  AnySolanaAddress,
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaTransaction,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';
import { Wormhole as WormholeCoreContract } from './types';
import {
  BridgeData,
  createBridgeFeeTransferInstruction,
  createPostMessageInstruction,
  createPostVaaInstruction,
  createReadOnlyWormholeProgramInterface,
  createVerifySignaturesInstructions,
  derivePostedVaaKey,
  getWormholeBridgeData,
} from './utils';

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

  private async findBridgeInstructions(
    accounts: MessageAccountKeys,
    response: VersionedTransactionResponse,
  ): Promise<MessageCompiledInstruction[]> {
    // find the instruction where the programId equals the Wormhole ProgramId
    const iix = response!
      .meta!.innerInstructions![0]!.instructions.filter((i) => {
        const programId = accounts.get(i.programIdIndex)!.toString();
        const wormholeCore = this.coreBridge.programId.toString();
        return programId === wormholeCore;
      })
      .map((ix) => {
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
    return [...iix, ...cix];
  }

  async parsePostMessageAccount(messageAccount: PublicKey): Promise<VAA> {
    const acctInfo = await this.connection.getAccountInfo(messageAccount);
    // TODO: use layouting
    const data = acctInfo?.data!.subarray(4)!;
    const consistencyLevel = data.readUint8(0); // pub version: u8,
    // const emitterAuthority = new Uint8Array(data.subarray(1, 33)); // pub emitter_authority: Pubkey,
    // const status = data.readUint8(33); // pub status: MessageStatus,
    // // gap 3 bytes
    const timestamp = data.readUint32LE(37);
    const nonce = data.readUint32LE(41);
    const sequence = data.readBigUInt64LE(45);
    const emitterAddress = new UniversalAddress(
      new Uint8Array(data.subarray(55, 87)),
    );
    const payloadLength = data.readUint32LE(87);
    const payload = new Uint8Array(data.subarray(91, 91 + payloadLength));
    const x = {
      guardianSet: 3, // TODO: should we get this from the contract on init?
      timestamp, // TODO: Would need to get the full block to get the timestamp
      emitterChain: this.chain,
      emitterAddress,
      consistencyLevel,
      sequence,
      nonce,
      payload,
      signatures: [],
    } as Parameters<typeof createVAA<'Uint8Array'>>[1];
    return createVAA<'Uint8Array'>('Uint8Array', x);
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
    const accounts = await this.getMessageAccountKeys(response);
    const bridgeInstructions = await this.findBridgeInstructions(
      accounts,
      response,
    );

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

  async parseMessages(txid: string): Promise<VAA[]> {
    const response: VersionedTransactionResponse | null =
      await this.connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

    if (!response || !response.meta || !response.meta.innerInstructions)
      throw new Error('transaction not found');

    // Otherwise we need to get it from the message account
    const accounts = await this.getMessageAccountKeys(response);
    const bridgeInstructions = await this.findBridgeInstructions(
      accounts,
      response,
    );

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
