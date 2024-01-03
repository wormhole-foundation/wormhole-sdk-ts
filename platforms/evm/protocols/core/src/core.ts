import {
  ChainsConfig,
  Contracts,
  Network,
  TxHash,
  VAA,
  WormholeCore,
  WormholeMessageId,
  isWormholeMessageId,
} from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';
import { ethers_contracts } from '.';
import { Implementation, ImplementationInterface } from './ethers-contracts';

import {
  AnyEvmAddress,
  EvmAddress,
  EvmChains,
  EvmPlatform,
  EvmPlatformType,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/connect-sdk-evm';
import {
  PlatformToChains,
  nativeChainIds,
} from '@wormhole-foundation/sdk-base';

export class EvmWormholeCore<
  N extends Network,
  C extends PlatformToChains<EvmPlatformType>,
> implements WormholeCore<N, EvmPlatformType, C>
{
  readonly chainId: bigint;

  readonly coreAddress: string;

  readonly core: Implementation;
  readonly coreIface: ImplementationInterface;

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    this.coreIface = ethers_contracts.Implementation__factory.createInterface();

    const address = this.contracts.coreBridge;
    if (!address) throw new Error('Core bridge address not found');

    this.coreAddress = address;
    this.core = ethers_contracts.Implementation__factory.connect(
      address,
      provider,
    );
  }

  async getMessageFee(): Promise<bigint> {
    return await this.core.messageFee.staticCall();
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, EvmPlatformType>,
  ): Promise<EvmWormholeCore<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    const conf = config[chain]!;

    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmWormholeCore<N, typeof chain>(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async *publishMessage(
    sender: AnyEvmAddress,
    message: Uint8Array,
    nonce: number,
    consistencyLevel: number,
  ) {
    const senderAddr = new EvmAddress(sender).toString();

    const txReq = await this.core.publishMessage.populateTransaction(
      nonce,
      message,
      consistencyLevel,
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'WormholeCore.publishMessage',
    );
  }

  async *verifyMessage(sender: AnyEvmAddress, vaa: VAA) {
    throw new Error('Not implemented.');
  }

  async parseTransaction(txid: TxHash): Promise<WormholeMessageId[]> {
    const receipt = await this.provider.getTransactionReceipt(txid);
    if (receipt === null) return [];

    return receipt.logs
      .filter((l: any) => {
        return l.address === this.coreAddress;
      })
      .map((log) => {
        const { topics, data } = log;
        const parsed = this.coreIface.parseLog({
          topics: topics.slice(),
          data,
        });
        if (parsed === null) return undefined;

        const emitterAddress = new EvmAddress(parsed.args['sender']);
        return {
          chain: this.chain,
          emitter: emitterAddress.toUniversalAddress(),
          sequence: parsed.args['sequence'],
        } as WormholeMessageId;
      })
      .filter(isWormholeMessageId);
  }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction<N, C> {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
