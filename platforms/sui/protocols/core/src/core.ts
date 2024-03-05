import { SuiClient } from "@mysten/sui.js/client";
import {
  AccountAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  PayloadLiteral,
  VAA,
  WormholeCore,
  WormholeMessageId,
  toChainId,
  toNative,
} from "@wormhole-foundation/connect-sdk";
import {
  AnySuiAddress,
  SuiChains,
  SuiPlatform,
  SuiPlatformType,
  SuiUnsignedTransaction,
} from "@wormhole-foundation/connect-sdk-sui";

export class SuiWormholeCore<N extends Network, C extends SuiChains> implements WormholeCore<N, C> {
  readonly chainId: ChainId;
  readonly coreBridgePackageId: string;

  private constructor(
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
    const txBlock = await this.provider.getTransactionBlock({
      digest: txid,
      options: { showEvents: true, showEffects: true, showInput: true },
    });

    const message = txBlock.events?.find((event) => event.type.endsWith("WormholeMessage"));
    if (!message || !message.parsedJson) {
      throw new Error("WormholeMessage not found");
    }
    const { sender: emitterAddress, sequence } = message.parsedJson as {
      sender: string;
      sequence: number;
    };

    return [
      {
        emitter: toNative(this.chain, emitterAddress).toUniversalAddress(),
        sequence: BigInt(sequence),
        chain: this.chain,
      },
    ];
  }

  async getGuardianSetIndex(): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  async parseMessages(txid: string): Promise<VAA[]> {
    throw new Error("Not implemented");
  }
}
