import type {
  ChainsConfig,
  Contracts,
  Network,
  TxHash,
  VAA,
  WormholeCore,
  WormholeMessageId,
} from '@wormhole-foundation/sdk-connect';
import {
  nativeChainIds,
  createVAA,
  isWormholeMessageId,
  encoding,
  serialize,
} from '@wormhole-foundation/sdk-connect';
import type { Provider, TransactionRequest } from 'ethers';
import { ethers_contracts } from './index.js';
import type {
  Implementation,
  ImplementationInterface,
} from './ethers-contracts/index.js';

import type {
  AnyEvmAddress,
  EvmChains,
  EvmPlatformType,
} from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';

export class EvmWormholeCore<N extends Network, C extends EvmChains>
  implements WormholeCore<N, C>
{
  readonly chainId: bigint;

  readonly coreAddress: string;

  readonly core: Implementation;
  readonly coreIface: ImplementationInterface;

  constructor(
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

  async getGuardianSetIndex(): Promise<number> {
    return Number(await this.core.getCurrentGuardianSetIndex.staticCall());
  }

  async getGuardianSet(index: number): Promise<WormholeCore.GuardianSet> {
    const guardianSet = await this.core.getGuardianSet(index);
    return {
      index: index,
      keys: guardianSet[0],
      expiry: guardianSet[1],
    };
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
    const senderAddr = new EvmAddress(sender).toString();
    const txReq = await this.core.parseAndVerifyVM.populateTransaction(
      serialize(vaa),
    );
    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'WormholeCore.verifyMessage',
    );
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

  async parseMessages(txid: string) {
    const receipt = await this.provider.getTransactionReceipt(txid);
    if (receipt === null) throw new Error('Could not get transaction receipt');
    const gsIdx = await this.getGuardianSetIndex();

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
        if (parsed === null) return null;

        const emitterAddress = new EvmAddress(parsed.args['sender']);
        return createVAA('Uint8Array', {
          guardianSet: gsIdx, // TODO: should we get this from the contract on init?
          timestamp: 0, // TODO: Would need to get the full block to get the timestamp
          emitterChain: this.chain,
          emitterAddress: emitterAddress.toUniversalAddress(),
          consistencyLevel: Number(parsed.args['consistencyLevel']),
          sequence: BigInt(parsed.args['sequence']),
          nonce: Number(parsed.args['nonce']),
          signatures: [],
          payload: encoding.hex.decode(parsed.args['payload']),
        });
      })
      .filter((vaa) => !!vaa) as VAA<'Uint8Array'>[];
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
