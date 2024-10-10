import type {
  AccountAddress,
  ChainAddress,
  ChainsConfig,
  Contracts,
  Network,
  Platform,
  TokenAddress,
  TokenId,
} from '@wormhole-foundation/sdk-connect';
import {
  PorticoBridge,
  Wormhole,
  canonicalAddress,
  isEqualCaseInsensitive,
  nativeChainIds,
  resolveWrappedToken,
  serialize,
  toChain,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import {
  EvmAddress,
  EvmPlatform,
  EvmUnsignedTransaction,
  addChainId,
  addFrom,
} from '@wormhole-foundation/sdk-evm';
import type { Provider, TransactionRequest } from 'ethers';
import { ethers, keccak256 } from 'ethers';
import { porticoAbi, uniswapQuoterV2Abi } from './abis.js';
import { PorticoApi } from './api.js';
import { FEE_TIER, supportedTokens } from './consts.js';

import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';
import { EvmTokenBridge } from '@wormhole-foundation/sdk-evm-tokenbridge';

import '@wormhole-foundation/sdk-evm-tokenbridge';

export class EvmPorticoBridge<
  N extends Network,
  C extends EvmChains = EvmChains,
> implements PorticoBridge<N, C>
{
  chainId: bigint;

  core: EvmWormholeCore<N, C>;

  tokenBridge: EvmTokenBridge<N, C>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (!contracts.portico)
      throw new Error('Unsupported chain, no contract addresses for: ' + chain);

    this.core = new EvmWormholeCore(network, chain, provider, contracts);

    this.tokenBridge = new EvmTokenBridge(network, chain, provider, contracts);

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;
  }

  static async fromRpc<N extends Network>(
    provider: Provider,
    config: ChainsConfig<N, Platform>,
  ): Promise<EvmPorticoBridge<N, EvmChains>> {
    const [network, chain] = await EvmPlatform.chainFromRpc(provider);

    const conf = config[chain]!;
    if (conf.network !== network)
      throw new Error(`Network mismatch: ${conf.network} != ${network}`);

    return new EvmPorticoBridge(network as N, chain, provider, conf.contracts);
  }

  async *transfer(
    sender: AccountAddress<C>,
    receiver: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    destToken: TokenId,
    destinationPorticoAddress: string,
    quote: PorticoBridge.Quote,
  ) {
    const { minAmountStart, minAmountFinish } = quote.swapAmounts;
    if (minAmountStart === 0n) throw new Error('Invalid min swap amount');
    if (minAmountFinish === 0n) throw new Error('Invalid min swap amount');

    const senderAddress = new EvmAddress(sender).toString();

    const [isStartTokenNative, startToken] = resolveWrappedToken(
      this.network,
      this.chain,
      token,
    );

    const [isFinalTokenNative, finalToken] = resolveWrappedToken(
      this.network,
      receiver.chain,
      destToken,
    );

    const startTokenAddress = canonicalAddress(startToken);

    const cannonTokenAddress = canonicalAddress(
      await this.getTransferrableToken(startTokenAddress),
    );

    const receiverAddress = canonicalAddress(receiver);

    const finalTokenAddress = canonicalAddress(finalToken);

    const nonce = new Date().valueOf() % 2 ** 4;

    const flags = PorticoBridge.serializeFlagSet({
      flags: {
        shouldWrapNative: isStartTokenNative,
        shouldUnwrapNative: isFinalTokenNative,
      },
      recipientChain: toChainId(receiver.chain),
      bridgeNonce: nonce,
      feeTierStart: FEE_TIER,
      feeTierFinish: FEE_TIER,
      padding: new Uint8Array(19),
    });

    const transactionData = porticoAbi.encodeFunctionData('start', [
      [
        flags,
        startTokenAddress.toLowerCase(),
        cannonTokenAddress,
        finalTokenAddress.toLowerCase(),
        receiverAddress,
        destinationPorticoAddress,
        amount.toString(),
        minAmountStart.toString(),
        minAmountFinish.toString(),
        quote.relayerFee.toString(),
      ],
    ]);

    const group = this.getTokenGroup(startToken.address.toString());
    const porticoAddress = this.getPorticoAddress(group);

    // Approve the token if necessary
    if (!isStartTokenNative)
      yield* this.approve(
        startTokenAddress,
        senderAddress,
        amount,
        porticoAddress,
      );

    const messageFee = await this.core.getMessageFee();

    const tx = {
      to: porticoAddress,
      data: transactionData,
      value: messageFee + (isStartTokenNative ? amount : 0n),
    };
    yield this.createUnsignedTransaction(
      addFrom(tx, senderAddress),
      'PorticoBridge.Transfer',
    );
  }

  async *redeem(sender: AccountAddress<C>, vaa: PorticoBridge.VAA) {
    const recipientChain = toChain(vaa.payload.payload.flagSet.recipientChain);
    const tokenAddress = vaa.payload.payload.finalTokenAddress
      .toNative(recipientChain)
      .toString();
    const group = this.getTokenGroup(tokenAddress);
    const porticoAddress = this.getPorticoAddress(group);
    const contract = new ethers.Contract(
      porticoAddress,
      porticoAbi.fragments,
      this.provider,
    );
    const txReq = await contract
      .getFunction('receiveMessageAndSwap')
      .populateTransaction(serialize(vaa));

    const address = new EvmAddress(sender).toString();

    yield this.createUnsignedTransaction(
      addFrom(txReq, address),
      'PorticoBridge.Redeem',
    );
  }

  async isTransferCompleted(vaa: PorticoBridge.VAA): Promise<boolean> {
    const isCompleted = await this.tokenBridge.tokenBridge.isTransferCompleted(
      keccak256(vaa.hash),
    );
    return isCompleted;
  }

  async quoteSwap(
    input: TokenAddress<C>,
    output: TokenAddress<C>,
    tokenGroup: string,
    amount: bigint,
  ): Promise<bigint> {
    const [, inputTokenId] = resolveWrappedToken(
      this.network,
      this.chain,
      input,
    );

    const [, outputTokenId] = resolveWrappedToken(
      this.network,
      this.chain,
      output,
    );

    const inputAddress = canonicalAddress(inputTokenId);
    const outputAddress = canonicalAddress(outputTokenId);

    if (isEqualCaseInsensitive(inputAddress, outputAddress)) return amount;

    const quoterAddress = this.getQuoterAddress(tokenGroup);
    const quoter = new ethers.Contract(
      quoterAddress,
      uniswapQuoterV2Abi.fragments,
      this.provider,
    );
    const result = await quoter
      .getFunction('quoteExactInputSingle')
      .staticCall([inputAddress, outputAddress, amount, FEE_TIER, 0]);

    return result[0];
  }

  async quoteRelay(startToken: TokenAddress<C>, endToken: TokenAddress<C>) {
    return await PorticoApi.quoteRelayer(this.chain, startToken, endToken);
  }

  // For a given token, return the Wormhole-wrapped/highway token
  // that actually gets bridged from this chain
  async getTransferrableToken(address: string): Promise<TokenId> {
    const token = Wormhole.tokenId(this.chain, address);
    const [, wrappedToken] = resolveWrappedToken(
      this.network,
      this.chain,
      token,
    );
    if (this.chain === 'Ethereum') return wrappedToken;

    // Find the group that this token belongs to
    const group = Object.values(supportedTokens).find((tokens) =>
      tokens.find(
        (t) =>
          t.chain === this.chain &&
          canonicalAddress(t) === canonicalAddress(wrappedToken),
      ),
    );
    if (!group)
      throw new Error(`No token group found for ${address} on ${this.chain}`);

    // Find the token in this group that originates on Ethereum
    const tokenOnEthereum = group.find((t) => t.chain === 'Ethereum');
    if (!tokenOnEthereum)
      throw new Error(
        `No Ethereum origin token found for ${address} on ${this.chain}`,
      );

    // Now find the corresponding Wormhole-wrapped/highway token on this chain
    const highwayTokenAddr =
      await this.tokenBridge.getWrappedAsset(tokenOnEthereum);

    return Wormhole.tokenId(this.chain, highwayTokenAddr.toString());
  }

  supportedTokens(): { group: string; token: TokenId }[] {
    const result = [];
    for (const [group, tokens] of Object.entries(supportedTokens)) {
      for (const token of tokens) {
        if (token.chain === this.chain) result.push({ group, token });
      }
    }
    return result;
  }

  getTokenGroup(address: string): string {
    const tokens = this.supportedTokens();
    const token = tokens.find((t) => canonicalAddress(t.token) === address);
    if (!token) throw new Error('Token not found');
    return token.group;
  }

  private async *approve(
    token: string,
    senderAddr: string,
    amount: bigint,
    contract: string,
  ) {
    const tokenContract = EvmPlatform.getTokenImplementation(
      this.provider,
      token,
    );
    const allowance = await tokenContract.allowance(senderAddr, contract);
    if (allowance < amount) {
      const txReq = await tokenContract.approve.populateTransaction(
        contract,
        amount,
      );
      yield this.createUnsignedTransaction(
        addFrom(txReq, senderAddr),
        'PorticoBridge.Approve',
      );
    }
  }

  private createUnsignedTransaction(
    txReq: TransactionRequest,
    description: string,
  ) {
    return new EvmUnsignedTransaction(
      addChainId(txReq, this.chainId),
      this.network,
      this.chain,
      description,
      false,
    );
  }

  getPorticoAddress(group: string) {
    const portico = this.contracts.portico!;
    if (group === 'USDT') {
      // Use PancakeSwap if available for USDT
      return portico.porticoPancakeSwap || portico.porticoUniswap;
    }
    return portico.porticoUniswap;
  }

  private getQuoterAddress(group: string) {
    const portico = this.contracts.portico!;
    if (group === 'USDT') {
      // Use PancakeSwap if available for USDT
      return portico.pancakeSwapQuoterV2 || portico.uniswapQuoterV2;
    }
    return portico.uniswapQuoterV2;
  }
}
