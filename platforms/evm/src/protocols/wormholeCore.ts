import { Network, WormholeCore } from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';
import { Implementation, ImplementationInterface } from '../ethers-contracts';

import {
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
} from '../constants';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { EvmContracts } from '../contracts';
import {
  EvmChainName,
  UniversalOrEvm,
  addChainId,
  addFrom,
  toEvmAddrString,
} from '../types';
import { EvmPlatform } from '../platform';

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
    sender: UniversalOrEvm,
    message: Uint8Array | string,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);

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
