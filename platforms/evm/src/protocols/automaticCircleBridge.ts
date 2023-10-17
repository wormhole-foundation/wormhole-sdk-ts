import {
  ChainAddress,
  AutomaticCircleBridge,
  TokenId,
  chainToChainId,
  Network,
} from '@wormhole-foundation/connect-sdk';

import { evmNetworkChainToEvmChainId } from '../constants';

import {
  AnyEvmAddress,
  EvmChainName,
  addChainId,
  addFrom,
} from '../types';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { CircleRelayer } from '../ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from '../contracts';
import { EvmPlatform } from '../platform';
import { EvmAddress } from '../address';

export class EvmAutomaticCircleBridge implements AutomaticCircleBridge<'Evm'> {
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: EvmContracts,
  ) {
    if (network === 'Devnet')
      throw new Error('AutomaticCircleBridge not supported on Devnet');

    this.chainId = evmNetworkChainToEvmChainId(network, chain);
    this.circleRelayer = this.contracts.getWormholeCircleRelayer(
      chain,
      provider,
    );
  }

  static async fromProvider(
    provider: Provider,
    contracts: EvmContracts,
  ): Promise<EvmAutomaticCircleBridge> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    return new EvmAutomaticCircleBridge(network, chain, provider, contracts);
  }

  async *transfer(
    token: TokenId,
    sender: AnyEvmAddress,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    const tokenAddr = new EvmAddress(token.address.toUniversalAddress()).toString();

    const tokenContract = EvmContracts.getTokenImplementation(
      this.provider,
      tokenAddr,
    );

    const allowance = await tokenContract.allowance(
      senderAddr,
      this.circleRelayer.target,
    );

    if (allowance < amount) {
      const txReq = await tokenContract.approve.populateTransaction(
        this.circleRelayer.target,
        amount,
      );
      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'ERC20.approve of CircleRelayer',
      );
    }

    const txReq =
      await this.circleRelayer.transferTokensWithRelay.populateTransaction(
        tokenAddr,
        amount,
        nativeTokenGas,
        recipientChainId,
        recipientAddress,
      );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'CircleRelayer.transfer',
    );
  }

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
