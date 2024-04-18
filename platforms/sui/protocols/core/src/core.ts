import type { SuiClient } from "@mysten/sui.js/client";
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
import { createVAA, toChainId } from "@wormhole-foundation/sdk-connect";
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
    readonly provider: SuiClient,
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
    connection: SuiClient,
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
    const txBlock = await this.provider.getTransactionBlock({
      digest: txid,
      options: { showEvents: true, showEffects: true, showInput: true },
    });

    const messages = txBlock.events?.filter((event) => event.type.endsWith("WormholeMessage"));
    if (!messages || messages.length == 0) throw new Error("WormholeMessage not found");

    return messages.map((message) => {
      const msg = message.parsedJson as {
        sender: string;
        sequence: string;
        consistency_level: number;
        nonce: number;
        payload: number[];
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
        payload: new Uint8Array(msg.payload),
      });
    });
  }
}
