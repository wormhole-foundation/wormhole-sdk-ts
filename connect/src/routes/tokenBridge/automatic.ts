import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, contracts } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
  TokenTransferDetails,
} from "@wormhole-foundation/sdk-definitions";
import { isNative, isTokenId, nativeTokenId } from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenBridge/tokenTransfer.js";
import type { AttestationReceipt, SourceInitiatedTransferReceipt } from "../../types.js";
import { TransferState } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import { MinAmountError } from "../types.js";
import type {
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { RouteTransferRequest } from "../request.js";

export namespace AutomaticTokenBridgeRoute {
  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas: number;
  };

  export type NormalizedParams = {
    fee: amount.Amount;
    amount: amount.Amount;
    nativeGasAmount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = AutomaticTokenBridgeRoute.Options;
type Vp = AutomaticTokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;
type R = Receipt<AttestationReceipt<"AutomaticTokenBridge">>;
type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;

export class AutomaticTokenBridgeRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof AutomaticTokenBridgeRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "AutomaticTokenBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    if (contracts.tokenBridgeRelayerChains.has(network)) {
      return contracts.tokenBridgeRelayerChains.get(network)!;
    }
    return [];
  }

  // get the list of source tokens that are possible to send
  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const atb = await fromChain.getAutomaticTokenBridge();
    const registered = await atb.getRegisteredTokens();
    return [
      nativeTokenId(fromChain.chain),
      ...registered.map((v) => {
        return { chain: fromChain.chain, address: v };
      }),
    ];
  }

  // get the list of destination tokens that may be received on the destination chain
  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    try {
      const expectedDestinationToken = await TokenTransfer.lookupDestinationToken(
        fromChain,
        toChain,
        sourceToken,
      );

      const atb = await toChain.getAutomaticTokenBridge();
      const acceptable = await atb.isRegisteredToken(expectedDestinationToken.address);
      if (!acceptable) {
        throw new Error("Destination token is not accepted by the AutomaticTokenBridge");
      }

      return [expectedDestinationToken];
    } catch (e) {
      return [];
    }
  }

  getDefaultOptions(): Op {
    return { nativeGas: 0.0 };
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    try {
      const options = params.options ?? this.getDefaultOptions();

      if (options.nativeGas && (options.nativeGas > 1.0 || options.nativeGas < 0.0))
        throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

      // native gas drop-off when the native token is the destination should be 0
      const { destination } = request;
      if (isNative(destination.id.address) && options.nativeGas === 0.0) options.nativeGas = 0;

      const updatedParams = { ...params, options };
      const validatedParams: Vp = {
        ...updatedParams,
        normalizedParams: await this.normalizeTransferParams(request, updatedParams),
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, params, error: e as Error };
    }
  }

  private async normalizeTransferParams(
    request: RouteTransferRequest<N>,
    params: Tp,
  ): Promise<AutomaticTokenBridgeRoute.NormalizedParams> {
    const amt = request.parseAmount(params.amount);

    const inputToken = isNative(request.source.id.address)
      ? await request.fromChain.getNativeWrappedTokenId()
      : request.source.id;

    const atb = await request.fromChain.getAutomaticTokenBridge();
    const fee: bigint = await atb.getRelayerFee(request.toChain.chain, inputToken.address);

    // Min amount is fee + 5%
    const minAmount = (fee * 105n) / 100n;
    if (amount.units(amt) < minAmount) {
      throw new MinAmountError(amount.fromBaseUnits(minAmount, amt.decimals));
    }

    const redeemableAmount = amount.units(amt) - fee;

    let srcNativeGasAmount = amount.fromBaseUnits(0n, request.source.decimals);
    if (params.options && params.options.nativeGas > 0) {
      const dtb = await request.toChain.getAutomaticTokenBridge();
      // the maxSwapAmount is in destination chain decimals
      let maxSwapAmount = await dtb.maxSwapAmount(request.destination.id.address);
      const redeemableAmountTruncated = amount.truncate(
        amount.fromBaseUnits(redeemableAmount, amt.decimals),
        TokenTransfer.MAX_DECIMALS,
      );
      const dstDecimals = await request.toChain.getDecimals(request.destination.id.address);
      const dstAmountReceivable = amount.units(
        amount.scale(redeemableAmountTruncated, dstDecimals),
      );
      if (dstAmountReceivable < maxSwapAmount) {
        // can't swap more than the receivable amount
        maxSwapAmount = dstAmountReceivable;
      }
      const scale = 10000;
      const scaledGasPercent = BigInt(Math.floor(params.options.nativeGas * scale));
      const dstNativeGasUnits = (maxSwapAmount * scaledGasPercent) / BigInt(scale);
      // the native gas percentage is applied to the max swap amount
      const dstNativeGasAmount = amount.fromBaseUnits(
        dstNativeGasUnits,
        request.destination.decimals,
      );
      // convert the native gas amount to source chain decimals
      srcNativeGasAmount = amount.scale(
        amount.truncate(dstNativeGasAmount, TokenTransfer.MAX_DECIMALS),
        request.source.decimals,
      );
      // can't request more gas than the redeemable amount
      if (amount.units(srcNativeGasAmount) > redeemableAmount) {
        srcNativeGasAmount = amount.fromBaseUnits(redeemableAmount, request.source.decimals);
      }
    }

    return {
      fee: amount.fromBaseUnits(fee, request.source.decimals),
      amount: amt,
      nativeGasAmount: srcNativeGasAmount,
    };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    const atb = await request.fromChain.getAutomaticTokenBridge();

    if (isTokenId(request.source.id)) {
      const isRegistered = await atb.isRegisteredToken(request.source.id.address);
      if (!isRegistered) {
        return {
          success: false,
          error: new Error("Source token is not registered"),
        };
      }
    }

    try {
      let quote = await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
        automatic: true,
        amount: amount.units(params.normalizedParams.amount),
        token: request.source.id,
        nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
      });
      return request.displayQuote(quote, params);
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  async initiate(
    request: RouteTransferRequest<N>,
    signer: Signer,
    quote: Q,
    to: ChainAddress,
  ): Promise<R> {
    const { params } = quote;
    const transfer = this.toTransferDetails(
      request,
      params,
      Wormhole.chainAddress(signer.chain(), signer.address()),
      to,
    );
    const txids = await TokenTransfer.transfer<N>(request.fromChain, transfer, signer);
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  public override async *track(receipt: R, timeout?: number) {
    try {
      yield* TokenTransfer.track(this.wh, receipt, timeout);
    } catch (e) {
      throw e;
    }
  }

  private toTransferDetails(
    request: RouteTransferRequest<N>,
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): TokenTransferDetails {
    const transfer = {
      from,
      to,
      automatic: true,
      amount: amount.units(params.normalizedParams.amount),
      token: request.source.id,
      nativeGas: amount.units(params.normalizedParams.nativeGasAmount),
    };

    return transfer;
  }
}
