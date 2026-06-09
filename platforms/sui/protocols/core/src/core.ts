import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type {
  AccountAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  PayloadLiteral,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from "@wormhole-foundation/sdk-connect";
import { createVAA, encoding, toChainId } from "@wormhole-foundation/sdk-connect";
import type {
  AnySuiAddress,
  SuiChains,
  SuiPlatformType,
  SuiUnsignedTransaction,
} from "@wormhole-foundation/sdk-sui";
import { SuiAddress, SuiPlatform } from "@wormhole-foundation/sdk-sui";

export class SuiWormholeCore<N extends Network, C extends SuiChains> implements WormholeCore<N, C> {
  readonly chainId: ChainId;
  readonly coreBridgePackageId: string;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: SuiGrpcClient,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);
    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(`CoreBridge contract Address for chain ${chain} not found`);
    this.coreBridgePackageId = coreBridgeAddress;
  }
  getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    throw new Error("Method not implemented.");
  }
  getMessageFee(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  static async fromRpc<N extends Network>(
    connection: SuiGrpcClient,
    config: ChainsConfig<N, SuiPlatformType>,
  ) {
    const [network, chain] = await SuiPlatform.chainFromRpc(connection);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} !== ${network}`);
    return new SuiWormholeCore(network as N, chain, connection, conf.contracts);
  }

  async *verifyMessage(
    sender: AccountAddress<C>,
    vaa: VAA<PayloadLiteral>,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }

  async *publishMessage(
    sender: AnySuiAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<SuiUnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const messages = await this.parseMessages(txid);
    return messages.map((message) => {
      return {
        emitter: message.emitterAddress,
        sequence: message.sequence,
        chain: this.chain,
      };
    });
  }

  async getGuardianSetIndex(): Promise<number> {
    throw new Error("Method not implemented.");
  }

  async parseMessages(txid: string) {
    const txResult = await this.provider.getTransaction({
      digest: txid,
      include: { events: true },
    });
    const tx = txResult.Transaction ?? txResult.FailedTransaction;

    const messages = tx?.events?.filter((event) => event.eventType.endsWith("WormholeMessage"));
    if (!messages || messages.length == 0) throw new Error("WormholeMessage not found");

    return messages.map((message) => {
      const msg = message.json as {
        sender: string;
        sequence: string;
        consistency_level: number;
        nonce: number;
        payload: string;
        timestamp: string;
      };

      return createVAA("Uint8Array", {
        emitterChain: this.chain,
        emitterAddress: new SuiAddress(msg.sender).toUniversalAddress(),
        sequence: BigInt(msg.sequence),
        guardianSet: 0, // TODO: need to implement guardian set idx
        timestamp: Number(msg.timestamp),
        consistencyLevel: msg.consistency_level,
        nonce: msg.nonce,
        signatures: [],
        payload: encoding.b64.decode(msg.payload),
      });
    });
  }
}
