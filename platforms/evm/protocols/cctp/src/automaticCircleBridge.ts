import {
  AutomaticCircleBridge,
  ChainAddress,
  ChainsConfig,
  CircleChainName,
  CircleNetwork,
  Contracts,
  Network,
  chainToChainId,
  usdcContract,
} from '@wormhole-foundation/connect-sdk';
import { Provider, TransactionRequest } from 'ethers';

import { CircleRelayer } from './ethers-contracts';

import {
  evmNetworkChainToEvmChainId,
  EvmAddress,
  EvmPlatform,
  AnyEvmAddress,
  EvmChainName,
  addChainId,
  addFrom,
  EvmUnsignedTransaction,
} from '@wormhole-foundation/connect-sdk-evm';
import { ethers_contracts } from '.';

export class EvmAutomaticCircleBridge implements AutomaticCircleBridge<'Evm'> {
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: Network,
    readonly chain: EvmChainName,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('AutomaticCircleBridge not supported on Devnet');

    this.chainId = evmNetworkChainToEvmChainId(network, chain);

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

  static async fromProvider(
    provider: Provider,
    config: ChainsConfig,
  ): Promise<EvmAutomaticCircleBridge> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    return new EvmAutomaticCircleBridge(
      network,
      chain,
      provider,
      config[chain]!.contracts!,
    );
  }

  async *transfer(
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

    const tokenAddr = usdcContract(
      this.network as CircleNetwork,
      this.chain as CircleChainName,
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
