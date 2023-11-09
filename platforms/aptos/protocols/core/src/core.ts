import {
  AnyAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  UnsignedTransaction,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/connect-sdk";
import { AptosChainName, AptosPlatform } from "@wormhole-foundation/connect-sdk-aptos";
import { AptosClient, Types } from "aptos";

export class AptosWormholeCore implements WormholeCore<"Aptos"> {
  readonly chainId: ChainId;

  private constructor(
    readonly network: Network,
    readonly chain: AptosChainName,
    readonly connection: AptosClient,
    readonly contracts: Contracts,
  ) {
    //this.chainId = toChainId(chain);
    //const coreBridgeAddress = contracts.coreBridge;
    //if (!coreBridgeAddress)
    //  throw new Error(
    //    `CoreBridge contract Address for chain ${chain} not found`,
    //  );
    //this.coreBridge = createReadOnlyWormholeProgramInterface(
    //  coreBridgeAddress,
    //  connection,
    //);
  }

  static async fromRpc(connection: AptosClient, config: ChainsConfig): Promise<AptosWormholeCore> {
    const [network, chain] = await AptosPlatform.chainFromRpc(connection);
    return new AptosWormholeCore(network, chain, connection, config[chain]!.contracts);
  }

  publishMessage(
    sender: AnyAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error("Method not implemented.");
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

    const { sender, sequence } = message.data;
    return [{ chain: this.chain, emitter: sender, sequence }] as WormholeMessageId[];
  }
}
