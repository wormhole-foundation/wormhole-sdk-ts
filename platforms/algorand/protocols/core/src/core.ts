import {
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
  StorageLogicSig,
  TransactionSignerPair,
  safeBigIntToNumber,
} from "@wormhole-foundation/connect-sdk-algorand";
import {
  Algodv2,
  OnApplicationComplete,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  modelsv2,
} from "algosdk";
import { maybeCreateStorageTx } from "./storage";
import { submitVAAHeader } from "./vaa";

export class AlgorandWormholeCore<N extends Network, C extends AlgorandChains>
  implements WormholeCore<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAppAddress: string;

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

  async *verifyMessage(sender: AnyAlgorandAddress, vaa: VAA) {
    const address = new AlgorandAddress(sender).toString();
    const txset = await submitVAAHeader(
      this.connection,
      this.coreAppId,
      this.coreAppId,
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

    const {
      accounts: [storageAddress],
      txs,
    } = await maybeCreateStorageTx(
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
      accounts: [storageAddress],
      onComplete: OnApplicationComplete.NoOpOC,
      suggestedParams,
    });

    yield this.createUnsignedTx({ tx: act }, "Core.publishMessage", true);
  }

  async parseTransaction(txId: string): Promise<WormholeMessageId[]> {
    const result = await this.connection.pendingTransactionInformation(txId).do();
    const ptr = modelsv2.PendingTransactionResponse.from_obj_for_encoding(result);

    // Expect target is core app
    if (BigInt(ptr.txn.txn.apid) !== this.coreAppId) throw new Error("Invalid app id");

    // Expect publish messeage as first arg
    const args = ptr.txn.txn.apaa;
    if (
      args.length !== 3 ||
      !encoding.bytes.equals(new Uint8Array(args[0]), AlgorandWormholeCore.publishMessage)
    )
      throw new Error("Invalid transaction arguments");

    if (!ptr.logs || ptr.logs.length === 0) throw new Error("No logs found to parse sequence");

    const sequence = encoding.bignum.decode(ptr.logs[0]);
    const emitter = new AlgorandAddress(ptr.txn.txn.snd).toUniversalAddress();

    return [{ chain: this.chain, emitter, sequence }];
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
