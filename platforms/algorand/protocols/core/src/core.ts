import {
  AccountAddress,
  ChainId,
  ChainsConfig,
  Contracts,
  Network,
  PayloadLiteral,
  UniversalAddress,
  UnsignedTransaction,
  VAA,
  WormholeCore,
  WormholeMessageId,
  encoding,
  toChainId,
} from "@wormhole-foundation/connect-sdk";
import {
  AlgorandChains,
  AlgorandPlatform,
  AlgorandPlatformType,
  AlgorandUnsignedTransaction,
  AnyAlgorandAddress,
} from "@wormhole-foundation/connect-sdk-algorand";
import { Algodv2, bytesToBigInt, decodeAddress, getApplicationAddress, modelsv2 } from "algosdk";

export class AlgorandWormholeCore<N extends Network, C extends AlgorandChains>
  implements WormholeCore<N, AlgorandPlatformType, C>
{
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAppAddress: string;

  private constructor(
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
  ): AsyncGenerator<AlgorandUnsignedTransaction<N, C>> {
    throw new Error("Method not implemented.");
  }

  async parseTransaction(txId: string): Promise<WormholeMessageId[]> {
    const result = await this.connection.pendingTransactionInformation(txId).do();
    const emitterAddr = new UniversalAddress(this.getEmitterAddressAlgorand(this.tokenBridgeAppId));
    const sequence = this.parseSequenceFromLogAlgorand(result);
    return [
      {
        chain: this.chain,
        emitter: emitterAddr,
        sequence,
      } as WormholeMessageId,
    ];
  }

  private getEmitterAddressAlgorand(appId: bigint): string {
    const appAddr: string = getApplicationAddress(appId);
    const decodedAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
    const hexAppAddr: string = encoding.hex.encode(decodedAppAddr);
    return hexAppAddr;
  }

  private parseSequenceFromLogAlgorand(result: Record<string, any>): bigint {
    let sequence: bigint | undefined;
    const ptr = modelsv2.PendingTransactionResponse.from_obj_for_encoding(result);
    if (ptr.innerTxns) {
      const innerTxns = ptr.innerTxns;
      innerTxns.forEach((txn) => {
        if (txn?.logs && txn.logs.length > 0 && txn.logs[0]) {
          sequence = bytesToBigInt(txn.logs[0].subarray(0, 8));
        }
      });
    }
    if (!sequence) {
      throw new Error("parseSequenceFromLogAlgorand - Sequence not found");
    }
    return sequence;
  }
}
