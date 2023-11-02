import {
  toChainId,
  chainIdToChain,
  Network,
  toChainName,
  serialize,
  UniversalAddress,
  ChainAddress,
  TokenBridge,
  TxHash,
  keccak256,
  TokenId,
  NativeAddress,
  toNative,
  ErrNotWrapped,
  TokenTransferTransaction,
  RpcConnection,
} from '@wormhole-foundation/connect-sdk';
import { AlgorandContracts } from '../../../src/contracts';

export class AlgorandTokenBridge implements TokenBridge<'Algorand'> {
  readonly chainId: ChainId;
  readonly tokenBridge: TokenBridgeContract;
  readonly coreBridge: CoreBridgeContract;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
    readonly connection: Connection,
    readonly contracts: AlgorandContracts,
  ) {
    this.chainId = toChainId(chain);
    this.tokenBridge = this.contracts.getTokenBridge(chain, connection);
    this.coreBridge = this.contracts.getCore(chain, connection);
  }

  static async fromProvider(
    connection: RpcConnection<'Algorand'>,
    contracts: AlgorandContracts,
  ): Promise<AlgorandTokenBridge> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(connection);
    return new AlgorandTokenBridge(network, chain, connection, contracts);
  }
}
