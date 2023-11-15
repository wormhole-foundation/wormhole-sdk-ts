import { JsonRpcProvider } from "@mysten/sui.js";
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
} from "@wormhole-foundation/connect-sdk";
import {
  AnySuiAddress,
  SuiChains,
  SuiPlatform,
  SuiPlatformType,
  SuiUnsignedTransaction,
} from "@wormhole-foundation/connect-sdk-sui";

export class SuiWormholeCore<N extends Network, C extends SuiChains>
  implements WormholeCore<N, SuiPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: JsonRpcProvider,
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
    connection: JsonRpcProvider,
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
    throw new Error("Not implemented");
  }
}
