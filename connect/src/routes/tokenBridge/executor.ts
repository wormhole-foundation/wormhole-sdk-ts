import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount, contracts } from "@wormhole-foundation/sdk-base";
import type {
  ChainAddress,
  ChainContext,
  Signer,
  TokenId,
  TokenTransferDetails,
  TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenBridge/tokenTransfer.js";
import type {
  AttestationReceipt,
  SourceInitiatedTransferReceipt,
  TransferReceipt,
} from "../../types.js";
import { TransferState /*isAttested*/ } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { RouteTransferRequest } from "../request.js";

export namespace TokenBridgeExecutorRoute {
  export type Options = {
    payload?: Uint8Array;
    nativeGas?: number;
  };

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = TokenBridgeExecutorRoute.Options;
type Vp = TokenBridgeExecutorRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TokenBridge">>;

export class TokenBridgeExecutorRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof TokenBridgeExecutorRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  static meta = {
    name: "TokenBridgeExecutorRoute",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    return contracts.tokenBridgeChains(network);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    try {
      return [await TokenTransfer.lookupDestinationToken(fromChain, toChain, sourceToken)];
    } catch (e) {
      return [];
    }
  }

  getDefaultOptions(): Op {
    return { payload: undefined, nativeGas: 0.0 };
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    const amt = amount.parse(params.amount, request.source.decimals);

    const options = params.options ?? this.getDefaultOptions();

    if (options.nativeGas && (options.nativeGas > 1.0 || options.nativeGas < 0.0))
      throw new Error("Native gas must be between 0.0 and 1.0 (0% and 100%)");

    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amt },
      options,
    };

    return { valid: true, params: validatedParams };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    try {
      return request.displayQuote(
        await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
          token: request.source.id,
          amount: amount.units(params.normalizedParams.amount),
          // ...params.options,
        }),
        params,
      );
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
    const transfer = await TokenTransfer.destinationOverrides(
      request.fromChain,
      request.toChain,
      this.toTransferDetails(
        request,
        params,
        Wormhole.chainAddress(signer.chain(), signer.address()),
        to,
      ),
    );
    const txids = await TokenTransfer.transfer<N>(request.fromChain, transfer, signer);
    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  async resume(txid: TransactionId): Promise<R> {
    const xfer = await TokenTransfer.from(this.wh, txid, 10 * 1000);
    return TokenTransfer.getReceipt(xfer);
  }

  public override async *track(receipt: R, timeout?: number) {
    // TODO: Implement executor API tracking logic here
    // For now, using the standard TokenTransfer.track
    yield* TokenTransfer.track(this.wh, receipt, timeout);
  }

  private toTransferDetails(
    request: RouteTransferRequest<N>,
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): TokenTransferDetails {
    return {
      from,
      to,
      token: request.source.id,
      amount: amount.units(params.normalizedParams.amount),
      // Note: We intentionally don't set automatic: true here
      // so that tokenTransfer.ts uses the manual logic
      // ...params.options,
    };
  }
}
