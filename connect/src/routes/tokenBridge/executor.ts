import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount as sdkAmount, contracts } from "@wormhole-foundation/sdk-base";
import {
  canonicalAddress,
  TokenBridgeExecutor,
  toNative,
  type ChainAddress,
  type ChainContext,
  type Signer,
  type TokenId,
  type TokenTransferDetails,
  type TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenBridge/tokenTransfer.js";
import type {
  AttestationReceipt,
  SourceInitiatedTransferReceipt,
  TransferReceipt,
} from "../../types.js";
import { isAttested, isFailed, TransferState } from "../../types.js";
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
import { signSendWait } from "../../common.js";

export namespace TokenBridgeExecutorRoute {
  export type Config = {
    // Referrer Fee in *tenths* of basis points - e.g. 10 = 1 basis point (0.01%)
    referrerFeeDbps?: bigint;
    // The address to which the referrer fee will be sent
    referrerAddresses?: Partial<Record<Network, Partial<Record<Chain, string>>>>;
    perTokenOverrides?: Partial<
      Record<
        Network,
        Record<
          Chain,
          Record<
            string,
            {
              referrerFeeDbps?: bigint;
              // Some tokens may require more gas to redeem than the default.
              gasLimit?: bigint;
            }
          >
        >
      >
    >;
  };

  export type Options = {
    // Expressed in percentage terms
    // e.g. 1.0 = 100%
    nativeGas?: number;
  };

  export type NormalizedParams = {
    amount: sdkAmount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = TokenBridgeExecutorRoute.Options;
type Vp = TokenBridgeExecutorRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type D = {
  executorQuote: TokenBridgeExecutor.ExecutorQuote;
  referrerFee?: TokenBridgeExecutor.ReferrerFee;
};

type QR = QuoteResult<Op, Vp, D>;
type Q = Quote<Op, Vp, D>;
type R = TransferReceipt<AttestationReceipt<"TokenBridgeExecutor">>;

export function tokenBridgeExecutorRoute(config: TokenBridgeExecutorRoute.Config = {}) {
  class TokenBridgeExecutorRouteImpl<N extends Network> extends TokenBridgeExecutorRoute<N> {
    static override config = config;
  }
  return TokenBridgeExecutorRouteImpl;
}

export class TokenBridgeExecutorRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof TokenBridgeExecutorRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  // @ts-ignore
  // Since we set the config on the static class, access it with this param
  // the TokenBridgeExecutorRoute.config will always be empty
  readonly staticConfig: TokenBridgeExecutorRoute.Config = this.constructor.config;
  static config: TokenBridgeExecutorRoute.Config = {};

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
    return { nativeGas: 0.0 };
  }

  async validate(request: RouteTransferRequest<N>, params: Tp): Promise<Vr> {
    const amt = sdkAmount.parse(params.amount, request.source.decimals);

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
      let referrerFeeDbps: bigint | undefined = undefined;
      let gasLimit: bigint | undefined = undefined;

      if (this.staticConfig.referrerFeeDbps !== undefined) {
        referrerFeeDbps = this.staticConfig.referrerFeeDbps;
      }

      if (this.staticConfig.perTokenOverrides) {
        const srcTokenAddress = canonicalAddress(request.source.id);
        const srcOverride =
          this.staticConfig.perTokenOverrides[this.wh.network]?.[request.fromChain.chain]?.[
            srcTokenAddress
          ];
        if (srcOverride?.referrerFeeDbps !== undefined) {
          referrerFeeDbps = srcOverride.referrerFeeDbps;
        }

        const dstTokenAddress = canonicalAddress(request.destination.id);
        const dstOverride =
          this.staticConfig.perTokenOverrides[this.wh.network]?.[request.destination.id.chain]?.[
            dstTokenAddress
          ];
        if (dstOverride?.gasLimit !== undefined) {
          gasLimit = dstOverride.gasLimit;
        }
      }

      let referrerAddress: ChainAddress | undefined = undefined;
      if (referrerFeeDbps !== undefined && referrerFeeDbps > 0n) {
        const referrer =
          this.staticConfig.referrerAddresses?.[this.wh.network]?.[request.fromChain.chain];
        if (!referrer) {
          throw new Error(
            `No referrer address configured for network ${this.wh.network} and chain ${request.fromChain.chain}`,
          );
        }
        referrerAddress = Wormhole.chainAddress(request.fromChain.chain, referrer);
      }

      const referrerFee =
        referrerFeeDbps !== undefined && referrerAddress !== undefined
          ? { feeDbps: referrerFeeDbps, referrer: referrerAddress }
          : undefined;

      const q = await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
        token: request.source.id,
        amount: sdkAmount.units(params.normalizedParams.amount),
        protocol: "TokenBridgeExecutor",
        nativeGasPercent: params.options.nativeGas,
        gasDropRecipient: request.recipient,
        gasLimit,
        referrerFee,
      });

      return request.displayQuote(q, params, q.details);
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
    const { fromChain, toChain } = request;
    const { params } = quote;
    const transfer = await TokenTransfer.destinationOverrides(
      fromChain,
      toChain,
      this.toTransferDetails(
        request,
        params,
        Wormhole.chainAddress(signer.chain(), signer.address()),
        to,
        quote,
      ),
    );
    const txids = await TokenTransfer.transfer<N>(fromChain, transfer, signer);

    // Status the transfer immediately before returning
    let statusAttempts = 0;

    const statusTransferImmediately = async () => {
      while (statusAttempts < 20) {
        try {
          const [txStatus] = await this.wh.getExecutorTxStatus(txids.at(-1)!.txid, fromChain.chain);

          if (txStatus) {
            break;
          }
        } catch (_) {
          // is ok we just try again!
        }
        statusAttempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };

    // Spawn a loop in the background that will status this transfer until
    // the API gives a successful response. We don't await the result
    // here because we don't need it for the return value.
    statusTransferImmediately();

    return {
      from: transfer.from.chain,
      to: transfer.to.chain,
      state: TransferState.SourceInitiated,
      originTxs: txids,
    } satisfies SourceInitiatedTransferReceipt;
  }

  async complete(signer: Signer, receipt: R): Promise<R> {
    if (!isAttested(receipt) && !isFailed(receipt)) {
      throw new Error("The source must be finalized in order to complete the transfer");
    }

    if (!receipt.attestation) {
      throw new Error("The receipt must have an attestation to complete the transfer");
    }

    const toChain = this.wh.getChain(receipt.to);
    const tb = await toChain.getTokenBridgeExecutor();
    const senderAddress = toNative(signer.chain(), signer.address());
    const xfer = tb.redeem(
      senderAddress,
      receipt.attestation.attestation as TokenBridgeExecutor.VAA,
    );
    const dstTxIds = await signSendWait<N, Chain>(toChain, xfer, signer);

    return {
      ...receipt,
      state: TransferState.DestinationInitiated,
      attestation: receipt.attestation as Required<AttestationReceipt<"TokenBridgeExecutor">>,
      destinationTxs: dstTxIds,
    };
  }

  async resume(txid: TransactionId): Promise<R> {
    const xfer = await TokenTransfer.from(this.wh, txid, 10 * 1000);
    if (xfer.transfer.protocol !== "TokenBridgeExecutor") {
      throw new Error("Can only resume TokenBridgeExecutor transfers");
    }
    return TokenTransfer.getReceipt(xfer);
  }

  public override async *track(receipt: R, timeout?: number) {
    for await (const r of TokenTransfer.track(this.wh, receipt, timeout)) {
      yield r as R;
    }
  }

  toTransferDetails(
    request: RouteTransferRequest<N>,
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
    quote: Q,
  ): TokenTransferDetails {
    if (!quote.details) throw new Error("Missing quote details");
    return {
      from,
      to,
      token: request.source.id,
      amount: sdkAmount.units(params.normalizedParams.amount),
      protocol: "TokenBridgeExecutor",
      executorQuote: quote.details.executorQuote,
      referrerFee: quote.details.referrerFee,
    };
  }
}
