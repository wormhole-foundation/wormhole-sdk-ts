import type {
  Chain,
  ChainAddress,
  Network,
  TokenAddress,
  TokenId,
} from '@wormhole-foundation/sdk-connect';
import {
  PorticoBridge,
  canonicalAddress,
  contracts,
  encoding,
  isEqualCaseInsensitive,
  isNative,
  nativeChainIds,
  resolveWrappedToken,
  toChainId,
} from '@wormhole-foundation/sdk-connect';
import type { EvmChains } from '@wormhole-foundation/sdk-evm';
import axios from 'axios';
import { porticoAbi } from './abis.js';
import { FEE_TIER } from './consts.js';

export const RELAYER_FEE_API_URL =
  'https://gfx.relayers.xlabs.xyz/api/v1/swap/quote';
export const OKU_TRADE_BASE_URL = 'https://oku.trade/app';

const CREATE_ORDER_API_URL = 'https://thermae.fly.dev/api/order/create';

export interface CreateOrderRequest {
  // Native chain id (eip155)
  startingChainId: number;
  destinationChainId: number;

  startingToken: string;
  startingTokenAmount: string;
  destinationToken: string;
  destinationAddress: string;
  relayerFee: string;
  feeTierStart: number;
  feeTierEnd: number;
  minAmountStart: string;
  minAmountEnd: string;
  bridgeNonce: number;
  shouldWrapNative: boolean;
  shouldUnwrapNative: boolean;
  porticoAddress: string;
  destinationPorticoAddress: string;
}

export interface CreateOrderResponse {
  transactionData: string;
  transactionTarget: string;
  transactionValue: string;
  startParameters: string[];
  estimatedAmountOut: string;
}

export interface RelayerQuoteResponse {
  fee: string;
  validUntil: string;
}

export class PorticoApi {
  // Post the order to the portico API
  static async createOrder<N extends Network, C extends EvmChains>(
    network: N,
    chain: C,
    receiver: ChainAddress,
    token: TokenAddress<C>,
    amount: bigint,
    destToken: TokenId,
    quote: PorticoBridge.Quote,
    nonce: number,
  ): Promise<CreateOrderResponse> {
    try {
      const { minAmountStart, minAmountFinish } = quote.swapAmounts;

      const receiverAddress = canonicalAddress(receiver);

      const [isStartTokenNative, startToken] = resolveWrappedToken(
        network,
        chain,
        token,
      );

      const [isFinalTokenNative, finalToken] = resolveWrappedToken(
        network,
        receiver.chain,
        destToken,
      );

      const startTokenAddress = canonicalAddress(startToken);
      const finalTokenAddress = canonicalAddress(finalToken);

      const sourcePorticoAddress = contracts.portico.get(
        network,
        chain,
      )!.portico;

      const destinationPorticoAddress = contracts.portico.get(
        network,
        receiver.chain,
      )!.portico;

      const startingChainId = nativeChainIds.networkChainToNativeChainId.get(
        network,
        chain,
      ) as bigint;

      const destinationChainId = nativeChainIds.networkChainToNativeChainId.get(
        network,
        receiver.chain,
      ) as bigint;

      // Create the order
      const orderRequest: CreateOrderRequest = {
        startingChainId: Number(startingChainId),
        startingToken: startTokenAddress.toLowerCase(),
        destinationChainId: Number(destinationChainId),
        destinationToken: finalTokenAddress.toLowerCase(),
        destinationAddress: receiverAddress,
        porticoAddress: sourcePorticoAddress,
        destinationPorticoAddress: destinationPorticoAddress,
        startingTokenAmount: amount.toString(),
        minAmountStart: minAmountStart.toString(),
        minAmountEnd: minAmountFinish.toString(),
        bridgeNonce: nonce,
        relayerFee: quote.relayerFee.toString(),
        feeTierStart: FEE_TIER,
        feeTierEnd: FEE_TIER,
        shouldWrapNative: isStartTokenNative,
        shouldUnwrapNative: isFinalTokenNative,
      };

      const response = await axios.post<CreateOrderResponse>(
        CREATE_ORDER_API_URL,
        orderRequest,
      );
      // Validate the response, not strictly necessary but if some details are wrong we want to know
      this.validateCreateOrderResponse(response.data, orderRequest);
      return response.data;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const message = `${e.response?.statusText}: ${e.response?.data.message}`;
        throw new Error(`Could not create order: ${message},`);
      }
      throw e;
    }
  }

  /**
   * Validates that the response from the order creation API matches the request
   * throws an error if there is a mismatch
   */
  static validateCreateOrderResponse = (
    response: CreateOrderResponse,
    request: CreateOrderRequest,
  ): void => {
    if (
      !isEqualCaseInsensitive(
        request.porticoAddress || '',
        response.transactionTarget,
      )
    ) {
      throw new Error('portico address mismatch');
    }

    const decoded = porticoAbi.decodeFunctionData(
      'start',
      response.transactionData,
    );
    if (decoded.length !== 1 || decoded[0].length !== 10) {
      throw new Error('decoded length mismatch');
    }

    const flagSetBuffer = encoding.hex.decode(decoded[0][0]);
    if (flagSetBuffer.length !== 32) {
      throw new Error('flag set length mismatch');
    }

    const { recipientChain, feeTierStart, feeTierFinish, flags } =
      PorticoBridge.deserializeFlagSet(flagSetBuffer);

    const { shouldWrapNative, shouldUnwrapNative } = flags;

    const [_, expectedChain] =
      nativeChainIds.platformNativeChainIdToNetworkChain(
        'Evm',
        BigInt(request.destinationChainId),
      );
    if (recipientChain !== toChainId(expectedChain)) {
      throw new Error('recipient chain mismatch');
    }

    if (feeTierStart !== request.feeTierStart) {
      throw new Error('fee tier start mismatch');
    }

    if (feeTierFinish !== request.feeTierEnd) {
      throw new Error('fee tier end mismatch');
    }

    if (!!shouldWrapNative !== request.shouldWrapNative) {
      throw new Error('should wrap native mismatch');
    }

    if (!!shouldUnwrapNative !== request.shouldUnwrapNative) {
      throw new Error('should unwrap native mismatch');
    }

    const startTokenAddress: string = decoded[0][1];
    if (!isEqualCaseInsensitive(startTokenAddress, request.startingToken)) {
      throw new Error('start token address mismatch');
    }

    // const startTokenId = Wormhole.chainAddress(toChain(request.startingChainId), startTokenAddress);
    // const canonicalTokenAddress: string = decoded[0][2];
    // if (!isEqualCaseInsensitive(canonicalTokenAddress, getOriginalAddress("Mainnet", startTokenId))) {
    //   throw new Error("canonical token address mismatch");
    // }

    const finalTokenAddress: string = decoded[0][3];
    if (!isEqualCaseInsensitive(finalTokenAddress, request.destinationToken)) {
      throw new Error('final token address mismatch');
    }

    const recipientAddress: string = decoded[0][4];
    if (!isEqualCaseInsensitive(recipientAddress, request.destinationAddress)) {
      throw new Error('recipient address mismatch');
    }

    const destinationPorticoAddress = decoded[0][5];
    if (
      !isEqualCaseInsensitive(
        destinationPorticoAddress,
        request.destinationPorticoAddress || '',
      )
    ) {
      throw new Error('destination portico address mismatch');
    }

    const amountSpecified: bigint = decoded[0][6];
    if (amountSpecified.toString() !== request.startingTokenAmount) {
      throw new Error('amount mismatch');
    }

    const minAmountStart: bigint = decoded[0][7];
    if (minAmountStart.toString() !== request.minAmountStart) {
      throw new Error('min amount start mismatch');
    }

    const minAmountFinish: bigint = decoded[0][8];
    if (minAmountFinish.toString() !== request.minAmountEnd) {
      throw new Error('min amount finish mismatch');
    }

    const relayerFee: bigint = decoded[0][9];
    if (relayerFee.toString() !== request.relayerFee) {
      throw new Error('relayer fee mismatch');
    }
  };

  static async quoteRelayer<C extends Chain>(
    chain: Chain,
    from: TokenAddress<C>,
    to: TokenAddress<C>,
  ): Promise<bigint> {
    if (isNative(from) || isNative(to))
      throw new Error('how did you get here tho?');

    const sourceToken = encoding.hex.encode(
      from.toUniversalAddress().toUint8Array(),
      false,
    );

    const targetToken = encoding.hex.encode(
      to.toUniversalAddress().toUint8Array(),
      false,
    );

    const targetChain = toChainId(chain);

    const request = { targetChain, sourceToken, targetToken };
    try {
      const response = await axios.post<RelayerQuoteResponse>(
        RELAYER_FEE_API_URL,
        request,
      );
      return BigInt(response.data.fee);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        throw new Error(`Error getting relayer fee: ${e.response?.statusText}`);
      }
      throw e;
    }
  }
}
