import {
  AccountAddress,
  AutomaticCircleBridge,
  ChainAddress,
  ChainsConfig,
  CircleChain,
  CircleNetwork,
  Contracts,
  Network,
  chainToChainId,
  usdcContract,
} from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';

import { CircleRelayer } from './ethers-contracts';

import {
  EvmChains,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/connect-sdk-evm';
import {
  Chain,
  Platform,
  networkChainToNativeChainId,
} from '@wormhole-foundation/sdk-base';
import { ethers_contracts } from '.';

export class EvmAutomaticCircleBridge<
  N extends Network,
  P extends 'Evm' = 'Evm',
  C extends Chain = EvmChains,
> implements AutomaticCircleBridge<P, C>
{
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('AutomaticCircleBridge not supported on Devnet');

    this.chainId = networkChainToNativeChainId.get(network, chain) as bigint;

    const relayerAddress = this.contracts.cctp?.wormholeRelayer;
    if (!relayerAddress)
      throw new Error(
        `Wormhole Circle relayer contract for domain ${chain} not found`,
      );

    this.circleRelayer = ethers_contracts.CircleRelayer__factory.connect(
      relayerAddress,
      provider,
    );
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmAutomaticCircleBridge<N>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    const conf = config[chain];

    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmAutomaticCircleBridge<N>(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction> {
    const senderAddr = sender.toNative(this.chain).toString();
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    const tokenAddr = usdcContract(
      this.network as CircleNetwork,
      this.chain as CircleChain,
    );

    const tokenContract = EvmPlatform.getTokenImplementation(
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
