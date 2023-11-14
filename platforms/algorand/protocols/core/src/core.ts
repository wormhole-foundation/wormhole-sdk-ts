import {
  ChainsConfig,
  Contracts,
  Network,
  TxHash,
  WormholeCore,
  WormholeMessageId,
  ChainId,
  toChainId,
  UniversalAddress,
} from '@wormhole-foundation/connect-sdk';
import {
  AlgorandChainName,
  AlgorandPlatform,
  AlgorandUnsignedTransaction,
  AnyAlgorandAddress,
} from '@wormhole-foundation/connect-sdk-algorand';
import {
  Algodv2,
  bytesToBigInt,
  decodeAddress,
  getApplicationAddress,
} from 'algosdk';

export class AlgorandWormholeCore implements WormholeCore<'Algorand'> {
  readonly chainId: ChainId;
  readonly coreAppId: bigint;
  readonly coreAppAddress: string;
  readonly tokenBridgeAppId: bigint;
  readonly tokenBridgeAddress: string;

  private constructor(
    readonly network: Network,
    readonly chain: AlgorandChainName,
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
      throw new Error(
        `TokenBridge contract address for chain ${chain} not found`,
      );
    }
    const tokenBridge = BigInt(contracts.tokenBridge);
    this.tokenBridgeAppId = tokenBridge;
    this.tokenBridgeAddress = getApplicationAddress(tokenBridge);
  }

  static async fromRpc(
    rpc: Algodv2,
    config: ChainsConfig,
  ): Promise<AlgorandWormholeCore> {
    const [network, chain] = await AlgorandPlatform.chainFromRpc(rpc);
    return new AlgorandWormholeCore(
      network,
      chain,
      rpc,
      config[chain]!.contracts,
    );
  }

  async *publishMessage(
    sender: AnyAlgorandAddress,
    message: Uint8Array | string,
  ): AsyncGenerator<AlgorandUnsignedTransaction> {
    throw new Error('Method not implemented.');
  }

  async parseTransaction(txid: TxHash): Promise<WormholeMessageId[]> {
    console.log('Txid: ', txid);
    const result = await this.connection
      .pendingTransactionInformation(txid)
      .do();
    console.log('Result: ', result);

    // QUESTIONBW: To make this work, I had to use the tokenBridgeAppId.  Expected?
    const emitterAddr = new UniversalAddress(
      this.getEmitterAddressAlgorand(this.tokenBridgeAppId),
    );
    console.log('parseTransaction emitterAddr: ', emitterAddr);

    const sequence = this.parseSequenceFromLogAlgorand(result);
    console.log('sequence: ', sequence);
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
    const decAppAddr: Uint8Array = decodeAddress(appAddr).publicKey;
    const hexAppAddr: string = Buffer.from(decAppAddr).toString('hex');
    console.log('core.ts Emitter address: ', hexAppAddr);
    return hexAppAddr;
  }

  private parseSequenceFromLogAlgorand(result: Record<string, any>): bigint {
    let sequence: bigint;
    if (result['inner-txns']) {
      const innerTxns: [] = result['inner-txns'];
      class iTxn {
        'local-state-delta': [[Object]];
        logs: Buffer[] | undefined;
        'pool-error': string;
        txn: { txn: [Object] } | undefined;
      }
      innerTxns.forEach((txn: iTxn) => {
        if (txn.logs) {
          sequence = bytesToBigInt(txn.logs[0].subarray(0, 8));
        }
      });
    }
    if (!sequence) {
      throw new Error('Sequence not found');
    }
    return sequence;
  }
}
