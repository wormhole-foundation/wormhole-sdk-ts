import type {
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  UnsignedTransaction,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-connect";
import { UniversalAddress, createVAA, encoding, toChainId } from "@wormhole-foundation/sdk-connect";
import type {
  AnyAptosAddress,
  AptosChains,
  AptosPlatformType,
} from "@wormhole-foundation/sdk-aptos";
import { AptosPlatform } from "@wormhole-foundation/sdk-aptos";
import { Aptos } from "@aptos-labs/ts-sdk";

export class AptosWormholeCore<N extends Network, C extends AptosChains>
  implements WormholeCore<N, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Aptos,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);
    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(`CoreBridge contract Address for chain ${chain} not found`);
    this.coreBridge = coreBridgeAddress;
  }
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    throw new Error("Method not implemented.");
  }
  getGuardianSetIndex(): Promise<number> {
    throw new Error("Method not implemented.");
  }
  getMessageFee(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  static async fromRpc<N extends Network>(
    connection: Aptos,
    config: ChainsConfig<N, AptosPlatformType>,
  ): Promise<AptosWormholeCore<N, AptosChains>> {
    const [network, chain] = await AptosPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
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
    const msgs = await this.parseMessages(txid);

    return msgs.map((message) => {
      return {
        chain: message.emitterChain,
        emitter: message.emitterAddress,
        sequence: message.sequence,
      };
    });
  }
  async parseMessages(txid: string) {
    const transaction = await this.connection.getTransactionByHash({ transactionHash: txid });
    if (transaction.type !== "user_transaction")
      throw new Error(`${txid} is not a user_transaction`);

    const messages = transaction.events.filter((event) => event.type.endsWith("WormholeMessage"));
    if (!messages || messages.length === 0)
      throw new Error(`WormholeMessage not found for ${txid}`);

    return messages.map((message) => {
      const msg = message.data as {
        consistency_level: number;
        nonce: string;
        payload: string;
        sender: string;
        sequence: string;
        timestamp: string;
      };

      const emitter = new UniversalAddress(BigInt(msg.sender).toString(16).padStart(64, "0"));

      return createVAA("Uint8Array", {
        guardianSet: 0, // TODO: need to implement guardian set idx
        emitterChain: this.chain,
        emitterAddress: emitter,
        sequence: BigInt(msg.sequence),
        timestamp: Number(msg.timestamp),
        consistencyLevel: msg.consistency_level,
        nonce: Number(msg.nonce),
        signatures: [],
        payload: encoding.hex.decode(msg.payload),
      });
    });
  }
}
