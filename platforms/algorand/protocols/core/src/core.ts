import {
  AccountAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  PayloadLiteral,
  UnsignedTransaction,
  VAA,
  WormholeCore,
  WormholeMessageId,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import {
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
  AnyAlgorandAddress,
} from "@wormhole-foundation/connect-sdk-algorand";
import { Algodv2 } from "algosdk";

export class AlgorandWormholeCore<N extends Network, C extends AlgorandChains>
  implements WormholeCore<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreBridge: string;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);
    const coreBridgeAddress = contracts.coreBridge;
    if (!coreBridgeAddress)
      throw new Error(`CoreBridge contract Address for chain ${chain} not found`);
    this.coreBridge = coreBridgeAddress;
  }
  verifyMessage(
    sender: AccountAddress<C>,
    vaa: VAA<PayloadLiteral>,
  ): AsyncGenerator<UnsignedTransaction<N, C>, any, unknown> {
    throw new Error("Method not implemented.");
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

  async *publishMessage(
    sender: AnyAlgorandAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<UnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    throw new Error("Not implemented");
  }
}
