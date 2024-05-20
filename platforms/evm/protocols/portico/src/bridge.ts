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
  contracts,
  isEqualCaseInsensitive,
  nativeChainIds,
  resolveWrappedToken,
  serialize,
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
import { ethers } from 'ethers';
import { porticoAbi, uniswapQuoterV2Abi } from './abis.js';
import { PorticoApi } from './api.js';
import { FEE_TIER } from './consts.js';
import {
  getTokensBySymbol,
  getTokenByAddress,
} from '@wormhole-foundation/sdk-connect/tokens';

import { EvmWormholeCore } from '@wormhole-foundation/sdk-evm-core';

import '@wormhole-foundation/sdk-evm-tokenbridge';

export class EvmPorticoBridge<
  N extends Network,
  C extends EvmChains = EvmChains,
> implements PorticoBridge<N, C>
{
  chainId: bigint;
  porticoAddress: string;
  uniswapAddress: string;

  porticoContract: ethers.Contract;
  uniswapContract: ethers.Contract;
  core: EvmWormholeCore<N, C>;

  constructor(
    readonly network: N,
    readonly chain: C,
    readonly provider: Provider,
    readonly contracts: Contracts,
  ) {
    if (!contracts.portico)
      throw new Error('Unsupported chain, no contract addresses for: ' + chain);

    this.core = new EvmWormholeCore(network, chain, provider, contracts);

    const { portico: porticoAddress, uniswapQuoterV2: uniswapAddress } =
      contracts.portico;

    this.porticoAddress = porticoAddress;
    this.uniswapAddress = uniswapAddress;

    this.chainId = nativeChainIds.networkChainToNativeChainId.get(
      network,
      chain,
    ) as bigint;

    this.porticoContract = new ethers.Contract(
      this.porticoAddress,
      porticoAbi.fragments,
      this.provider,
    );

    this.uniswapContract = new ethers.Contract(
      this.uniswapAddress,
      uniswapQuoterV2Abi.fragments,
      this.provider,
    );
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
      this.getTransferrableToken(startTokenAddress),
    );

    const receiverAddress = canonicalAddress(receiver);

    const finalTokenAddress = canonicalAddress(finalToken);

    const destinationPorticoAddress = contracts.portico.get(
      this.network,
      receiver.chain,
    )!.portico;

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

    // Approve the token if necessary
    if (!isStartTokenNative)
      yield* this.approve(
        startTokenAddress,
        senderAddress,
        amount,
        this.porticoAddress,
      );

    const messageFee = await this.core.getMessageFee();

    const tx = {
      to: this.porticoAddress,
      data: transactionData,
      value: messageFee + (isStartTokenNative ? amount : 0n),
    };
    yield this.createUnsignedTransaction(
      addFrom(tx, senderAddress),
      'PorticoBridge.Transfer',
    );
  }

  async *redeem(sender: AccountAddress<C>, vaa: PorticoBridge.VAA) {
    const txReq = await this.porticoContract
      .getFunction('receiveMessageAndSwap')
      .populateTransaction(serialize(vaa));

    const address = new EvmAddress(sender).toString();

    yield this.createUnsignedTransaction(
      addFrom(txReq, address),
      'PorticoBridge.Redeem',
    );
  }

  async quoteSwap(
    input: TokenAddress<C>,
    output: TokenAddress<C>,
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

    const result = await this.uniswapContract
      .getFunction('quoteExactInputSingle')
      .staticCall([inputAddress, outputAddress, amount, FEE_TIER, 0]);

    return result[0];
  }

  async quoteRelay(startToken: TokenAddress<C>, endToken: TokenAddress<C>) {
    return await PorticoApi.quoteRelayer(this.chain, startToken, endToken);
  }

  // For a given token, return the corresponding
  // Wormhole wrapped token that originated on Ethereum
  getTransferrableToken(address: string): TokenId {
    if (this.chain === 'Ethereum') return Wormhole.tokenId('Ethereum', address);

    // get the nativeTokenDetails
    const nToken = getTokenByAddress(this.network, this.chain, address);
    if (!nToken) throw new Error('Unsupported source token: ' + address);

    const xToken = getTokensBySymbol(
      this.network,
      this.chain,
      nToken.symbol,
    )?.find((orig) => {
      return orig.original === 'Ethereum';
    });
    if (!xToken)
      throw new Error(
        `Unsupported symbol for chain ${nToken.symbol}: ${this.chain} `,
      );

    return Wormhole.tokenId(xToken.chain, xToken.address);
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
}
