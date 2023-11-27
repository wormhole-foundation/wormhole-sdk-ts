import { Program } from '@project-serum/anchor';
import { Connection, Keypair, Transaction } from '@solana/web3.js';
import {
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  VAA,
  WormholeCore,
  WormholeMessageId,
  toChainId,
  toNative,
} from '@wormhole-foundation/connect-sdk';
import {
  AnySolanaAddress,
  SolanaAddress,
  SolanaChains,
  SolanaPlatform,
  SolanaPlatformType,
  SolanaUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-solana';
import { Wormhole as WormholeCoreContract } from './types';
import {
  createPostVaaInstruction,
  createReadOnlyWormholeProgramInterface,
  createVerifySignaturesInstructions,
} from './utils';

const SOLANA_SEQ_LOG = 'Program log: Sequence: ';

export class SolanaWormholeCore<N extends Network, C extends SolanaChains>
  implements WormholeCore<N, SolanaPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: Program<WormholeCoreContract>;
  readonly address: string;

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
  ): Promise<SolanaWormholeCore<N, SolanaChains>> {
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

  publishMessage(
    sender: AnySolanaAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<SolanaUnsignedTransaction<N, C>> {
    throw new Error('Method not implemented.');
  }

  async *postVaa(sender: AnySolanaAddress, vaa: VAA, blockhash: string) {
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

    // Create a new transaction for every 2 signatures we have to Verify
    for (let i = 0; i < verifySignaturesInstructions.length; i += 2) {
      const verifySigTx = new Transaction().add(
        ...verifySignaturesInstructions.slice(i, i + 2),
      );
      verifySigTx.recentBlockhash = blockhash;
      verifySigTx.feePayer = senderAddr;
      verifySigTx.partialSign(signatureSet);

      yield this.createUnsignedTx(verifySigTx, 'Redeem.VerifySignature', true);
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
    postVaaTx.recentBlockhash = blockhash;
    postVaaTx.feePayer = senderAddr;

    yield this.createUnsignedTx(postVaaTx, 'Redeem.PostVAA');
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const response = await this.connection.getTransaction(txid);
    if (!response || !response.meta?.innerInstructions![0]?.instructions)
      throw new Error('transaction not found');

    const instructions = response.meta?.innerInstructions![0].instructions;
    const accounts = response.transaction.message.accountKeys;

    // find the instruction where the programId equals the Wormhole ProgramId and the emitter equals the Token Bridge
    const bridgeInstructions = instructions.filter((i) => {
      const programId = accounts[i.programIdIndex]!.toString();
      const wormholeCore = this.coreBridge.programId.toString();
      return programId === wormholeCore;
    });

    if (bridgeInstructions.length === 0)
      throw new Error('no bridge messages found');

    // TODO: unsure about the single bridge instruction and the [2] index, will this always be the case?
    const [logmsg] = bridgeInstructions;
    const emitterAcct = accounts[logmsg!.accounts[2]!];
    const emitter = toNative(this.chain, emitterAcct!.toString());

    const sequence = response.meta?.logMessages
      ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
      ?.replace(SOLANA_SEQ_LOG, '');

    if (!sequence) {
      throw new Error('sequence not found');
    }

    return [
      {
        chain: this.chain,
        emitter: emitter.toUniversalAddress(),
        sequence: BigInt(sequence),
      },
    ];
  }

  private createUnsignedTx(
    txReq: Transaction,
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
