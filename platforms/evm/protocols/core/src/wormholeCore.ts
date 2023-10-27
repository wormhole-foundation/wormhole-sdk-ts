import { Network, WormholeCore } from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';
import { Implementation, ImplementationInterface } from './ethers-contracts';

import {
  evmNetworkChainToEvmChainId,
  EvmUnsignedTransaction,
  EvmContracts,
  AnyEvmAddress,
  EvmChainName,
  addChainId,
  addFrom,
  EvmPlatform,
  EvmAddress,
} from '@wormhole-foundation/connect-sdk-evm';

export class EvmWormholeCore implements WormholeCore<'Evm'> {
  readonly chainId: bigint;

  readonly core: Implementation;
  readonly coreIface: ImplementationInterface;

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: EvmContracts,
  ) {
    this.chainId = evmNetworkChainToEvmChainId.get(network, chain)!;

    this.core = this.contracts.getCoreImplementation(chain, provider);
    this.coreIface = this.contracts.getCoreImplementationInterface();
  }

  static async fromProvider(
    provider: Provider,
    contracts: EvmContracts,
  ): Promise<EvmWormholeCore> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    return new EvmWormholeCore(network, chain, provider, contracts);
  }

  async *publishMessage(
    sender: AnyEvmAddress,
    message: Uint8Array | string,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = new EvmAddress(sender).toString();

    const txReq = await this.core.publishMessage.populateTransaction(
      0,
      message,
      200, // TODO: lookup finality
    );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'WormholeCore.publishMessage',
    );
  }

  // async parseTransactionDetails(
  //   txid: TxHash,
  // ): Promise<TokenTransferTransaction[]> {
  //   const receipt = await this.provider.getTransactionReceipt(txid);
  //   if (receipt === null)
  //     throw new Error(`No transaction found with txid: ${txid}`);
  // }

  private createUnsignedTx(
    txReq: TransactionRequest,
    description: string,
    parallelizable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      parallelizable,
    );
  }
}
