import { Program } from '@project-serum/anchor';
import {
  Connection,
  Keypair,
  MessageAccountKeys,
  MessageCompiledInstruction,
  Transaction,
  VersionedTransactionResponse,
} from '@solana/web3.js';
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
    const response: VersionedTransactionResponse | null =
      await this.connection.getTransaction(txid, {
        maxSupportedTransactionVersion: 0,
      });

    if (!response || !response.meta || !response.meta.innerInstructions)
      throw new Error('transaction not found');

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
      console.log(programId, wormholeCore);
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
        console.log(programId, wormholeCore);
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
      const emitter = toNative(this.chain, emitterAddr);

      return {
        chain: this.chain,
        emitter: emitter.toUniversalAddress(),
        sequence: BigInt(sequence),
      };
    });

    return await Promise.all(messagePromises);
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
