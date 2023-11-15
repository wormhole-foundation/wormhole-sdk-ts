import {
  Algodv2,
  // decodeAddress,
  getApplicationAddress,
  waitForConfirmation,
} from 'algosdk';
import {
  AnyAddress,
  ChainId,
  toChainId,
  ChainsConfig,
  Contracts,
  Network,
  UnsignedTransaction,
  WormholeCore,
  WormholeMessageId,
} from '@wormhole-foundation/connect-sdk';
import {
  AlgorandAddress,
  AlgorandChainName,
  AlgorandPlatform,
} from '@wormhole-foundation/connect-sdk-algorand';

export class AlgorandWormholeCore implements WormholeCore<'Algorand'> {
  readonly chainId: ChainId;
  readonly coreBridgeAddress: AlgorandAddress;
  readonly tokenBridgeAddress: AlgorandAddress;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
    readonly connection: Algodv2,
    readonly contracts: Contracts,
  ) {
    this.chainId = toChainId(chain);

    this.coreBridgeAddress = new AlgorandAddress(
      getApplicationAddress(BigInt(contracts.coreBridge)),
    );

    if (!this.coreBridgeAddress)
      throw new Error(
        `CoreBridge contract Address for chain ${chain} not found`,
      );

    const tokenBridgeAddress = contracts.tokenBridge;
    if (!tokenBridgeAddress)
      throw new Error(
        `TokenBridge contract Address for chain ${chain} not found`,
      );
    this.tokenBridgeAddress = new AlgorandAddress(
      getApplicationAddress(BigInt(tokenBridgeAddress)),
    );
  }

  static async fromRpc(
    connection: Algodv2,
    config: ChainsConfig,
  ): Promise<AlgorandWormholeCore> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(connection);
    return new AlgorandWormholeCore(
      network,
      chain,
      connection,
      config[chain]!.contracts,
    );
  }

  publishMessage(
    sender: AnyAddress,
    message: string | Uint8Array,
  ): AsyncGenerator<UnsignedTransaction, any, unknown> {
    throw new Error('Method not implemented.');
  }

  async parseTransaction(txid: string): Promise<WormholeMessageId[]> {
    const response = await waitForConfirmation(this.connection, txid, 1);
    if (!response) throw new Error('transaction not found');

    let sequence = BigInt(0);
    if (response['inner-txns']) {
      const innerTxns: [] = response['inner-txns'];
      class iTxn {
        'local-state-delta': [[Object]];
        logs: Buffer[] | undefined;
        'pool-error': string;
        txn: { txn: [Object] } | undefined;
      }
      innerTxns.forEach((txn: iTxn) => {
        if (txn.logs) {
          sequence = BigInt(
            '0x' + Buffer.from(txn.logs[0].slice(0, 8)).toString('hex'),
          );
        }
      });
    }

    return [
      {
        chain: this.chain,
        emitter: this.tokenBridgeAddress.toUniversalAddress(),
        sequence: sequence,
      },
    ];
  }
}
