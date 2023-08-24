import {
  chainToChainId,
  evmChainIdToNetworkChainPair,
  evmNetworkChainToEvmChainId,
} from '@wormhole-foundation/sdk-base';
import {
  ChainAddress,
  WormholeCircleRelayer,
} from '@wormhole-foundation/sdk-definitions';

import {
  EvmChainName,
  UniversalOrEvm,
  addChainId,
  addFrom,
  toEvmAddrString,
} from '../types';
import { EvmUnsignedTransaction } from '../unsignedTransaction';
import { CircleRelayer } from '../ethers-contracts';
import { Provider, TransactionRequest } from 'ethers';
import { EvmContracts } from '../contracts';
import { TokenId } from '@wormhole-foundation/connect-sdk';

export class EvmCircleRelayer implements WormholeCircleRelayer<'Evm'> {
  readonly contracts: EvmContracts;
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: 'Mainnet' | 'Testnet',
    readonly chain: EvmChainName,
    readonly provider: Provider,
  ) {
    this.contracts = new EvmContracts(network);

    this.chainId = evmNetworkChainToEvmChainId(network, chain);
    this.circleRelayer = this.contracts.mustGetWormholeCircleRelayer(
      chain,
      provider,
    );
  }

  static async fromProvider(provider: Provider): Promise<EvmCircleRelayer> {
    const { chainId } = await provider.getNetwork();
    const networkChainPair = evmChainIdToNetworkChainPair.get(chainId);
    if (networkChainPair === undefined)
      throw new Error(`Unknown EVM chainId ${chainId}`);

    const [network, chain] = networkChainPair;
    return new EvmCircleRelayer(network, chain, provider);
  }

  async *transfer(
    token: TokenId,
    sender: UniversalOrEvm,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = toEvmAddrString(sender);
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address.toString();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    const tokenAddr = toEvmAddrString(token.address);

    const tokenContract = this.contracts.mustGetTokenImplementation(
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
    stackable: boolean = false,
  ): EvmUnsignedTransaction {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      stackable,
    );
  }
}
