import {
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  WormholeCore,
  WormholeMessageId,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import {
  AnyAptosAddress,
  AptosChains,
  AptosPlatform,
  AptosPlatformType,
} from "@wormhole-foundation/connect-sdk-aptos";
import { AptosClient, Types } from "aptos";

export class AptosWormholeCore<N extends Network, C extends AptosChains>
  implements WormholeCore<N, AptosPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: AptosClient,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);
    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(`CoreBridge contract Address for chain ${chain} not found`);
    this.coreBridge = coreBridgeAddress;
  }
  getMessageFee(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  static async fromRpc<N extends Network>(
    connection: AptosClient,
    config: ChainsConfig<N, AptosPlatformType>,
  ): Promise<AptosWormholeCore<N, AptosChains>> {
    const [network, chain] = await AptosPlatform.chainFromRpc(connection);
    const conf = config[chain];
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} !== ${network}`);
    return new AptosWormholeCore(network as N, chain, connection, conf.contracts);
  }

  async *publishMessage(
    sender: AnyAptosAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }
  async *verifyMessage(sender: AnyAptosAddress, vaa: VAA) {
    throw new Error("Not implemented.");
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const transaction = await this.connection.getTransactionByHash(txid);
    if (transaction.type !== "user_transaction")
      throw new Error(`${txid} is not a user_transaction`);

    const userTransaction = transaction as Types.UserTransaction;
    const message = userTransaction.events.find((event) => event.type.endsWith("WormholeMessage"));
    if (!message || !message.data) {
      throw new Error(`WormholeMessage not found for ${txid}`);
    }

    const { sender, sequence } = message.data as { sender: string; sequence: string };
    // TODO: make this work for address
    const emitter = new UniversalAddress(BigInt(sender).toString(16).padStart(64, "0"));

    return [{ chain: this.chain, emitter, sequence: BigInt(sequence) }] as WormholeMessageId[];
  }
}
