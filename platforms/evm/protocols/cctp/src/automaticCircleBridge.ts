import {
  AccountAddress,
  AutomaticCircleBridge,
  Chain,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  chainToChainId,
  circle,
  nativeChainIds,
  toChainId,
} from '@wormhole-foundation/connect-sdk';

import { Provider, TransactionRequest, keccak256 } from 'ethers';
import { ethers_contracts } from '.';
import { CircleRelayer } from './ethers-contracts';

import {
  EvmAddress,
  EvmChains,
  EvmPlatform,
  EvmPlatformType,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/connect-sdk-evm';

import { ethers_contracts as tb_contracts } from '@wormhole-foundation/connect-sdk-evm-tokenbridge';
import '@wormhole-foundation/connect-sdk-evm-core';
import '@wormhole-foundation/connect-sdk-evm-tokenbridge';

export class EvmAutomaticCircleBridge<N extends Network, C extends EvmChains>
  implements AutomaticCircleBridge<N, EvmPlatformType, C>
{
  readonly circleRelayer: CircleRelayer;
  readonly chainId: bigint;
  readonly tokenBridge: tb_contracts.TokenBridgeContract;
  readonly tokenAddr: string;

  // https://github.com/wormhole-foundation/wormhole-connect/blob/development/sdk/src/contexts/eth/context.ts#L379

  private constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('AutomaticCircleBridge not supported on Devnet');

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    const relayerAddress = this.contracts.cctp?.wormholeRelayer;
    if (!relayerAddress)
      throw new Error(
        `Wormhole Circle relayer contract for domain ${chain} not found`,
      );

    this.circleRelayer = ethers_contracts.CircleRelayer__factory.connect(
      relayerAddress,
      provider,
    );

    const tbAddress = this.contracts.tokenBridge;
    if (!tbAddress)
      throw new Error(`TokenBridge contract not found for ${chain}`);

    this.tokenBridge = tb_contracts.Bridge__factory.connect(
      tbAddress,
      provider,
    );
    const tokenAddr = circle.usdcContract.get(
      this.network as circle.CircleNetwork,
      this.chain as circle.CircleChain,
    );

    if (!tokenAddr)
      throw new Error(
        `USDC contract not found for ${this.network} ${this.chain}`,
      );

    this.tokenAddr = tokenAddr;
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmAutomaticCircleBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);
    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);
    return new EvmAutomaticCircleBridge(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  async getRelayerFee(destination: Chain): Promise<bigint> {
    return this.circleRelayer.relayerFee(
      toChainId(destination),
      this.tokenAddr,
    );
  }

  async isTransferCompleted(vaa: AutomaticCircleBridge.VAA): Promise<boolean> {
    return this.tokenBridge.isTransferCompleted(keccak256(vaa.hash));
  }

  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientChainId = chainToChainId(recipient.chain);
    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();
    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      this.tokenAddr,
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
        this.tokenAddr,
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
