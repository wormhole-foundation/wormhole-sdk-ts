import {
  keccak256,
  serialize,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  VAA,
  WormholeCore,
  WormholeMessageId,
  encoding,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import {
  AlgorandAddress,
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
  AlgorandUnsignedTransaction,
  AnyAlgorandAddress,
  TransactionSet,
  TransactionSignerPair,
  safeBigIntToNumber,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  Algodv2,
  LogicSigAccount,
  OnApplicationComplete,
  SuggestedParams,
  Transaction,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeApplicationOptInTxnFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  modelsv2,
  signLogicSigTransaction,
} from "algosdk";

import { SEED_AMT, StorageLogicSig } from "./storage";

export class AlgorandWormholeCore<N extends Network, C extends AlgorandChains>
  implements WormholeCore<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAppAddress: string;

  static MAX_SIGS_PER_TXN: number = 6;
  static ALGO_VERIFY_HASH = "EZATROXX2HISIRZDRGXW4LRQ46Z6IUJYYIHU3PJGP7P5IQDPKVX42N767A";
  static ALGO_VERIFY = new Uint8Array([
    6, 32, 4, 1, 0, 32, 20, 38, 1, 0, 49, 32, 50, 3, 18, 68, 49, 1, 35, 18, 68, 49, 16, 129, 6, 18,
    68, 54, 26, 1, 54, 26, 3, 54, 26, 2, 136, 0, 3, 68, 34, 67, 53, 2, 53, 1, 53, 0, 40, 53, 240,
    40, 53, 241, 52, 0, 21, 53, 5, 35, 53, 3, 35, 53, 4, 52, 3, 52, 5, 12, 65, 0, 68, 52, 1, 52, 0,
    52, 3, 129, 65, 8, 34, 88, 23, 52, 0, 52, 3, 34, 8, 36, 88, 52, 0, 52, 3, 129, 33, 8, 36, 88, 7,
    0, 53, 241, 53, 240, 52, 2, 52, 4, 37, 88, 52, 240, 52, 241, 80, 2, 87, 12, 20, 18, 68, 52, 3,
    129, 66, 8, 53, 3, 52, 4, 37, 8, 53, 4, 66, 255, 180, 34, 137,
  ]);

  // global state key for message fee
  static feeKey = encoding.b64.encode("MessageFee");
  // method selector for verifying a VAA
  static verifyVaa = encoding.bytes.encode("verifyVAA");
  // method selector for verifying signatures of a VAA
  static verifySigs = encoding.bytes.encode("verifySigs");
  // method selector string for publishing a message
  static publishMessage = encoding.bytes.encode("publishMessage");

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    if (!contracts.coreBridge) {
      throw new Error(`Core contract address for chain ${chain} not found`);
    }
    const core = BigInt(contracts.coreBridge);
    this.coreAppId = core;
    this.coreAppAddress = getApplicationAddress(core);

    if (!contracts.tokenBridge) {
      throw new Error(`TokenBridge contract address for chain ${chain} not found`);
    }
    const tokenBridge = BigInt(contracts.tokenBridge);
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAppAddress = getApplicationAddress(tokenBridge);
  }

  async *verifyMessage(sender: AnyAlgorandAddress, vaa: VAA, appId?: bigint) {
    const address = new AlgorandAddress(sender).toString();
    const txset = await AlgorandWormholeCore.submitVAAHeader(
      this.connection,
      this.coreAppId,
      appId ?? this.coreAppId,
      vaa,
      address,
    );

    for (const tx of txset.txs) {
      yield this.createUnsignedTx(tx, "Core.verifyMessage");
    }
  }

  static async fromRpc<N extends Network>(
    connection: Algodv2,
    config: ChainsConfig<N, AlgorandPlatformType>,
  ): Promise<AlgorandWormholeCore<N, AlgorandChains>> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} !== ${network}`);
    return new AlgorandWormholeCore(network as N, chain, connection, conf.contracts);
  }

  async *publishMessage(sender: AnyAlgorandAddress, message: Uint8Array) {
    // Call core bridge to publish message
    const _sender = new AlgorandAddress(sender);
    const address = _sender.toString();
    const suggestedParams = await this.connection.getTransactionParams().do();

    const storage = StorageLogicSig.forEmitter(this.coreAppId, _sender.toUint8Array());

    const { accounts, txs } = await AlgorandWormholeCore.maybeCreateStorageTx(
      this.connection,
      address,
      this.coreAppId,
      storage,
      suggestedParams,
    );

    for (const tx of txs) {
      yield this.createUnsignedTx(tx, "Core.publishMessage", true);
    }

    const act = makeApplicationCallTxnFromObject({
      from: address,
      appIndex: safeBigIntToNumber(this.coreAppId),
      appArgs: [AlgorandWormholeCore.publishMessage, message, encoding.bignum.toBytes(0n, 8)],
      accounts: accounts,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    });

    yield this.createUnsignedTx({ tx: act }, "Core.publishMessage", true);
  }

  /**
   * Return the message fee for the core bridge
   * @param client An Algodv2 client
   * @param bridgeId The application ID of the core bridge
   * @returns Promise with the message fee for the core bridge
   */
  async getMessageFee(): Promise<bigint> {
    const applInfoResp: Record<string, any> = await this.connection
      .getApplicationByID(safeBigIntToNumber(this.coreAppId))
      .do();
    const appInfo = modelsv2.Application.from_obj_for_encoding(applInfoResp);
    const val = appInfo.params.globalState?.find((kv) => kv.key === AlgorandWormholeCore.feeKey);
    return val ? BigInt(val.value.uint) : 0n;
  }

  async parseTransaction(txId: string): Promise<WormholeMessageId[]> {
    const result = await this.connection.pendingTransactionInformation(txId).do();
    const ptr = modelsv2.PendingTransactionResponse.from_obj_for_encoding(result);
    return this.parseTx(ptr);
  }

  private parseTx(ptr: modelsv2.PendingTransactionResponse): WormholeMessageId[] {
    const msgs: WormholeMessageId[] = [];

    if (ptr.innerTxns && ptr.innerTxns.length > 0) {
      msgs.push(...ptr.innerTxns.flatMap((tx) => this.parseTx(tx)));
    }

    // Expect target is core app
    if (BigInt(ptr.txn.txn.apid ?? 0) !== this.coreAppId) return msgs;

    // Expect logs
    if (!ptr.logs || ptr.logs.length === 0) return msgs;

    // Expect publish messeage as first arg
    const args = ptr.txn.txn.apaa ?? [];
    if (
      args.length !== 3 ||
      !encoding.bytes.equals(new Uint8Array(args[0]!), AlgorandWormholeCore.publishMessage)
    )
      return msgs;

    const sequence = encoding.bignum.decode(ptr.logs[0]!);
    const emitter = new AlgorandAddress(ptr.txn.txn.snd).toUniversalAddress();
    msgs.push({ chain: this.chain, emitter, sequence });

    return msgs;
  }

  /**
   * Constructs opt in transactions
   * @param client An Algodv2 client
   * @param senderAddr Sender address
   * @param appId Application ID
   * @param storage StorageLogicSig
   * @returns Address and array of TransactionSignerPairs
   */
  static async maybeCreateStorageTx(
    client: Algodv2,
    senderAddr: string,
    appId: bigint,
    storage: LogicSigAccount,
    suggestedParams?: SuggestedParams,
  ): Promise<TransactionSet> {
    const appAddr: string = getApplicationAddress(appId);
    const storageAddress = storage.address();

    const txs: TransactionSignerPair[] = [];

    if (await StorageLogicSig.storageAccountExists(client, storageAddress, appId))
      return { accounts: [storageAddress], txs };

    suggestedParams = suggestedParams ?? (await client.getTransactionParams().do());

    // Pay the storage account some ALGO to min balance requirements
    const seedTxn = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: storageAddress,
      amount: SEED_AMT,
      suggestedParams,
    });
    seedTxn.fee = seedTxn.fee * 2;
    txs.push({ tx: seedTxn });

    // Opt in to the app and rekey to the app address that is using
    // this as storage
    const optinTxn = makeApplicationOptInTxnFromObject({
      from: storageAddress,
      appIndex: safeBigIntToNumber(appId),
      rekeyTo: appAddr,
      suggestedParams,
    });
    optinTxn.fee = 0;
    txs.push({
      tx: optinTxn,
      signer: {
        address: storage.address(),
        signTxn: (txn: Transaction) => Promise.resolve(signLogicSigTransaction(txn, storage).blob),
      },
    });

    return {
      accounts: [storageAddress],
      txs,
    };
  }

  /**
   * Submits just the header of the VAA
   * @param client AlgodV2 client
   * @param bridgeId Application ID of the core bridge
   * @param vaa The VAA (just the header is used)
   * @param senderAddr Sending account address
   * @param appid Application ID
   * @returns Promise with current VAA state
   */
  static async submitVAAHeader(
    client: Algodv2,
    coreId: bigint,
    appid: bigint,
    vaa: VAA,
    senderAddr: string,
    suggestedParams?: SuggestedParams,
  ): Promise<TransactionSet> {
    suggestedParams = suggestedParams ?? (await client.getTransactionParams().do());

    let txs: TransactionSignerPair[] = [];

    // Get storage acct for message ID
    const msgStorage = StorageLogicSig.forMessageId(appid, {
      chain: vaa.emitterChain,
      sequence: vaa.sequence,
      emitter: vaa.emitterAddress,
    });
    const { accounts: seqAddr, txs: seqOptInTxs } = await AlgorandWormholeCore.maybeCreateStorageTx(
      client,
      senderAddr,
      appid,
      msgStorage,
      suggestedParams,
    );
    txs.push(...seqOptInTxs);

    // Get storage account for Guardian set
    const gsStorage = StorageLogicSig.forGuardianSet(coreId, vaa.guardianSet);
    const { accounts: guardianAddr, txs: guardianOptInTxs } =
      await AlgorandWormholeCore.maybeCreateStorageTx(
        client,
        senderAddr,
        coreId,
        gsStorage,
        suggestedParams,
      );
    txs.push(...guardianOptInTxs);

    let accts: string[] = [...seqAddr, ...guardianAddr];

    // Get the Guardian keys
    const keys: Uint8Array = await StorageLogicSig.decodeLocalState(
      client,
      coreId,
      guardianAddr[0]!,
    );

    // We don't pass the entire payload in but instead just pass it pre-digested.  This gets around size
    // limitations with lsigs AND reduces the cost of the entire operation on a congested network by reducing the
    // bytes passed into the transaction
    // This is a 2 pass digest
    const digest = keccak256(vaa.hash);

    // How many signatures can we process in a single txn... we can do 6!
    // There are likely upwards of 19 signatures.  So, we ned to split things up
    const numSigs: number = vaa.signatures.length;
    const numTxns: number = Math.floor(numSigs / AlgorandWormholeCore.MAX_SIGS_PER_TXN) + 1;
    const GuardianKeyLen: number = 20;
    const lsa = new LogicSigAccount(AlgorandWormholeCore.ALGO_VERIFY);

    for (let nt = 0; nt < numTxns; nt++) {
      let sigs = vaa.signatures.slice(nt, nt + AlgorandWormholeCore.MAX_SIGS_PER_TXN);

      // The keyset is the set of Guardians that correspond
      // to the current set of signatures in this loop.
      // Each signature in 20 bytes and comes from decodeLocalState()
      let arraySize: number = sigs.length * GuardianKeyLen;
      let keySet: Uint8Array = new Uint8Array(arraySize);

      for (let i = 0; i < sigs.length; i++) {
        // The first byte of the sig is the relative index of that signature in the signatures array
        // Use that index to get the appropriate Guardian key
        const sig = sigs[i]!;
        const key = keys.slice(
          sig.guardianIndex * GuardianKeyLen + 1,
          (sig.guardianIndex + 1) * GuardianKeyLen + 1,
        );
        keySet.set(key, i * 20);
      }

      const appTxn = makeApplicationCallTxnFromObject({
        appArgs: [
          AlgorandWormholeCore.verifySigs,
          encoding.bytes.concat(
            ...sigs.map((s) =>
              encoding.bytes.concat(new Uint8Array([s.guardianIndex]), s.signature.encode()),
            ),
          ),
          keySet,
          digest,
        ],
        accounts: accts,
        appIndex: safeBigIntToNumber(coreId),
        from: AlgorandWormholeCore.ALGO_VERIFY_HASH,
        onComplete: OnApplicationComplete.NoOpOC,
        suggestedParams,
      });
      appTxn.fee = 0;
      txs.push({
        tx: appTxn,
        signer: {
          address: lsa.address(),
          signTxn: (txn: Transaction) => Promise.resolve(signLogicSigTransaction(txn, lsa).blob),
        },
      });
    }
    const appTxn = makeApplicationCallTxnFromObject({
      appArgs: [AlgorandWormholeCore.verifyVaa, serialize(vaa)],
      accounts: accts,
      appIndex: safeBigIntToNumber(coreId),
      from: senderAddr,
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    });
    appTxn.fee = appTxn.fee * (2 + numTxns); // Was 1
    txs.push({ tx: appTxn });

    return { accounts: accts, txs };
  }

  private createUnsignedTx(
    txReq: TransactionSignerPair,
    description: string,
    parallelizable: boolean = true, // Default true for Algorand atomic transaction grouping
  ): AlgorandUnsignedTransaction<N, C> {
    return new AlgorandUnsignedTransaction(
      txReq,
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
