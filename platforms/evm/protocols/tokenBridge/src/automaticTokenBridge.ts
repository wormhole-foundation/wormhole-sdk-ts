import type {
  AccountAddress,
  AutomaticTokenBridge,
  Chain,
  ChainAddress,
  ChainsConfig,
  Contracts,
  NativeAddress,
  Network,
  TokenAddress,
} from '@wormhole-foundation/sdk-connect';
import {
  isNative,
  serialize,
  toNative,
  nativeChainIds,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains, EvmPlatformType } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';
import { ethers_contracts } from './index.js';

import '@wormhole-foundation/sdk-evm-core';

export class EvmAutomaticTokenBridge<N extends Network, C extends EvmChains>
  implements AutomaticTokenBridge<N, C>
{
  readonly tokenBridgeRelayer: ethers_contracts.TokenBridgeRelayer;
  readonly tokenBridge: ethers_contracts.TokenBridgeContract;
  readonly chainId: bigint;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (network === 'Devnet')
      throw new Error('AutomaticTokenBridge not supported on Devnet');

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    const tokenBridgeAddress = this.contracts.tokenBridge!;
    if (!tokenBridgeAddress)
      throw new Error(
        `Wormhole Token Bridge contract for domain ${chain} not found`,
      );

    this.tokenBridge = ethers_contracts.Bridge__factory.connect(
      tokenBridgeAddress,
      provider,
    );

    const relayerAddress = this.contracts.tokenBridgeRelayer;
    if (!relayerAddress)
      throw new Error(
        `Wormhole Token Bridge Relayer contract for domain ${chain} not found`,
      );

    this.tokenBridgeRelayer =
      ethers_contracts.TokenBridgeRelayer__factory.connect(
        relayerAddress,
        provider,
      );
  }
  async *redeem(
    sender: AccountAddress<C>,
    vaa: AutomaticTokenBridge.VAA,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const txReq =
      await this.tokenBridgeRelayer.completeTransferWithRelay.populateTransaction(
        serialize(vaa),
      );

    yield this.createUnsignedTx(
      addFrom(txReq, senderAddr),
      'TokenBridgeRelayer.completeTransferWithRelay',
    );
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, EvmPlatformType>,
  ): Promise<EvmAutomaticTokenBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmAutomaticTokenBridge<N, EvmChains>(
      network as N,
      chain,
      provider,
      conf.contracts,
    );
  }

  //alternative naming: initiateTransfer
  async *transfer(
    sender: AccountAddress<C>,
    recipient: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    nativeGas?: bigint,
  ): AsyncGenerator<EvmUnsignedTransaction<N, C>> {
    const senderAddr = new EvmAddress(sender).toString();
    const recipientChainId = toChainId(recipient.chain);

    const recipientAddress = recipient.address
      .toUniversalAddress()
      .toUint8Array();

    const nativeTokenGas = nativeGas ? nativeGas : 0n;

    if (isNative(token)) {
      const txReq =
        await this.tokenBridgeRelayer.wrapAndTransferEthWithRelay.populateTransaction(
          nativeTokenGas,
          recipientChainId,
          recipientAddress,
          0, // skip batching
          { value: amount },
        );

      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridgeRelayer.wrapAndTransferETHWithRelay',
      );
    } else {
      //TODO check for ERC-2612 (permit) support on token?
      const tokenAddr = new EvmAddress(token).toString();

      const tokenContract = EvmPlatform.getTokenImplementation(
        this.provider,
        tokenAddr,
      );
      const allowance = await tokenContract.allowance(
        senderAddr,
        this.tokenBridgeRelayer.target,
      );

      if (allowance < amount) {
        const txReq = await tokenContract.approve.populateTransaction(
          this.tokenBridgeRelayer.target,
          amount,
        );
        yield this.createUnsignedTx(
          addFrom(txReq, senderAddr),
          'AutomaticTokenBridge.Approve',
        );
      }

      const txReq =
        await this.tokenBridgeRelayer.transferTokensWithRelay.populateTransaction(
          tokenAddr,
          amount,
          nativeTokenGas,
          recipientChainId,
          recipientAddress,
          0,
        );

      yield this.createUnsignedTx(
        addFrom(txReq, senderAddr),
        'TokenBridgeRelayer.TransferTokensWithRelay',
      );
    }
  }

  async getRelayerFee(
    destination: Chain,
    token: TokenAddress<C>,
  ): Promise<bigint> {
    const destChainId = toChainId(destination);
    const srcTokenAddress = await this.tokenAddress(token);

    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      srcTokenAddress,
    );

    const decimals = await tokenContract.decimals();
    return await this.tokenBridgeRelayer.calculateRelayerFee(
      destChainId,
      srcTokenAddress,
      decimals,
    );
  }

  // Return the amount of native gas that will be
  // received when the incoming bridge transfer is redeemed
  // Note: for a quote, this should be called on the destination chain
  async nativeTokenAmount(
    token: TokenAddress<C>,
    amount: bigint,
  ): Promise<bigint> {
    const address = await this.tokenAddress(token);
    return this.tokenBridgeRelayer.calculateNativeSwapAmountOut(
      address,
      amount,
    );
  }

  async maxSwapAmount(token: TokenAddress<C>): Promise<bigint> {
    const address = await this.tokenAddress(token);
    return this.tokenBridgeRelayer.calculateMaxSwapAmountIn(address);
  }

  async getRegisteredTokens(): Promise<NativeAddress<C>[]> {
    const tokens = await this.tokenBridgeRelayer.getAcceptedTokensList();
    return tokens.map((address) => toNative(this.chain, address));
  }

  async isRegisteredToken(token: TokenAddress<C>): Promise<boolean> {
    const address = await this.tokenAddress(token);
    return await this.tokenBridgeRelayer.isAcceptedToken(address);
  }

  private async tokenAddress(token: TokenAddress<C>): Promise<string> {
    return isNative(token)
      ? await this.tokenBridge.WETH()
      : new EvmAddress(token).toString();
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
