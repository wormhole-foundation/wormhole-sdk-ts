import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount as sdkAmount, contracts } from "@wormhole-foundation/sdk-base";
import type {
  CapabilitiesResponse,
  ExecutorTokenBridge,
  UnsignedTransaction,
} from "@wormhole-foundation/sdk-definitions";
import {
  canonicalAddress,
  isTokenId,
  toNative,
  UniversalAddress,
  type ChainAddress,
  type ChainContext,
  type Signer,
  type TokenId,
  type TransactionId,
} from "@wormhole-foundation/sdk-definitions";
import { TokenTransfer } from "../../protocols/tokenBridge/tokenTransfer.js";
import type {
  AttestationReceipt,
  AttestedTransferReceipt,
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
import { collectTransactions, signSendWait } from "../../common.js";

export namespace ExecutorTokenBridgeRoute {
  export type Config = {
    executor?: {
      /** Override the default capabilities fetcher (e.g. to cache or use a custom endpoint). */
      getCapabilities?: (network: Network) => Promise<CapabilitiesResponse>;
    };
    getFee?: GetFeeCallback;
    tokenOverrides?: Partial<
      Record<
        Network,
        Record<
          Chain,
          Record<
            string,
            {
              // Some tokens may require more gas to redeem than the default.
              gasLimit?: bigint;
            }
          >
        >
      >
    >;
  };

  export type GetFeeResult = {
    transferTokenFee: bigint;
    nativeTokenFee: bigint;
    referrerAddress: string;
  };

  export type GetFeeCallback = (params: {
    amount: bigint;
    sourceChain: Chain;
    sourceToken: string;
    destinationChain: Chain;
    destinationToken: string;
  }) => Promise<GetFeeResult>;

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

type Op = ExecutorTokenBridgeRoute.Options;
type Vp = ExecutorTokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type D = {
  executorQuote: ExecutorTokenBridge.ExecutorQuote;
  referrerFee?: ExecutorTokenBridge.ReferrerFee;
};

type QR = QuoteResult<Op, Vp, D>;
type Q = Quote<Op, Vp, D>;
type R = TransferReceipt<AttestationReceipt<"ExecutorTokenBridge">>;

export function executorTokenBridgeRoute(config: ExecutorTokenBridgeRoute.Config = {}) {
  class ExecutorTokenBridgeRouteImpl<N extends Network> extends ExecutorTokenBridgeRoute<N> {
    static override config = config;
  }
  return ExecutorTokenBridgeRouteImpl;
}

export class ExecutorTokenBridgeRoute<N extends Network>
  extends AutomaticRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof ExecutorTokenBridgeRoute>
{
  static IS_EXECUTOR_ROUTE = true;

  static NATIVE_GAS_DROPOFF_SUPPORTED = true;

  // @ts-ignore
  // Since we set the config on the static class, access it with this param
  // the ExecutorTokenBridgeRoute.config will always be empty
  readonly staticConfig: ExecutorTokenBridgeRoute.Config = this.constructor.config;
  static config: ExecutorTokenBridgeRoute.Config = {};

  static meta = {
    name: "TokenBridgeExecutorRoute",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }

  static supportedChains(network: Network): Chain[] {
    if (network === "Devnet") return [];
    return contracts.executorTokenBridgeChains(network);
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
    // Check that source and destination chains are different
    if (request.fromChain.chain === request.toChain.chain) {
      return {
        valid: false,
        params,
        error: new Error("Source and destination chains cannot be the same"),
      };
    }

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
    const supportedChains = ExecutorTokenBridgeRoute.supportedChains(request.fromChain.network);
    // Check if the fromChain and toChain are supported by the Executor Token Bridge
    if (
      !supportedChains.includes(request.fromChain.chain) ||
      !supportedChains.includes(request.toChain.chain)
    ) {
      return {
        success: false,
        error: new Error(
          `Executor Token Bridge does not support transfers from ${request.fromChain.chain} to ${request.toChain.chain}`,
        ),
      };
    }

    try {
      const dstTb = await request.toChain.getExecutorTokenBridge();
      let { gasLimit, msgValue } = await dstTb.estimateMsgValueAndGasLimit(
        request.destination.id,
        request.recipient,
      );

      // Check for per-token gas limit overrides
      if (this.staticConfig.tokenOverrides) {
        const dstTokenAddress = canonicalAddress(request.destination.id);
        const dstOverride =
          this.staticConfig.tokenOverrides[this.wh.network]?.[request.destination.id.chain]?.[
            dstTokenAddress
          ];
        if (dstOverride?.gasLimit !== undefined) {
          gasLimit = dstOverride.gasLimit;
        }
      }

      let referrerFee:
        | { transferTokenFee: bigint; nativeTokenFee: bigint; referrer: ChainAddress }
        | undefined;
      if (this.staticConfig.getFee) {
        // Pass the truncated amount (what will actually be bridged) so the
        // callback sees the same value that downstream fee math operates on.
        const truncatedAmount = sdkAmount.truncate(
          params.normalizedParams.amount,
          TokenTransfer.MAX_DECIMALS,
        );
        const result = await this.staticConfig.getFee({
          amount: sdkAmount.units(truncatedAmount),
          sourceChain: request.fromChain.chain,
          sourceToken: canonicalAddress(request.source.id),
          destinationChain: request.toChain.chain,
          destinationToken: canonicalAddress(request.destination.id),
        });
        if (result.transferTokenFee > 0n || result.nativeTokenFee > 0n) {
          if (!result.referrerAddress) {
            throw new Error(
              `getFee returned a referrer fee (transferTokenFee=${result.transferTokenFee}, nativeTokenFee=${result.nativeTokenFee}) but no referrerAddress for ${request.fromChain.chain}`,
            );
          }
          referrerFee = {
            transferTokenFee: result.transferTokenFee,
            nativeTokenFee: result.nativeTokenFee,
            referrer: Wormhole.chainAddress(request.fromChain.chain, result.referrerAddress),
          };
        }
      }

      // Convert nativeGas percentage to actual amount if provided
      let nativeGas: bigint | undefined;
      if (params.options.nativeGas !== undefined) {
        const gasDropOffLimit = await TokenTransfer.getExecutorGasDropOffLimit(
          this.wh,
          request.toChain,
          this.staticConfig.executor?.getCapabilities,
        );

        nativeGas =
          gasDropOffLimit > 0n
            ? (BigInt(Math.round(params.options.nativeGas * 100)) * gasDropOffLimit) / 100n
            : 0n;
      }

      const q = await TokenTransfer.quoteTransfer(
        this.wh,
        request.fromChain,
        request.toChain,
        {
          token: request.source.id,
          amount: sdkAmount.units(params.normalizedParams.amount),
          protocol: "ExecutorTokenBridge",
          nativeGas,
          msgValue,
          gasLimit,
          referrerFee,
        },
        this.staticConfig.executor?.getCapabilities,
      );

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
    const { fromChain } = request;
    const sender = Wormhole.chainAddress(signer.chain(), signer.address());
    const xfer = await this._buildInitiateXfer(request, sender, to, quote);
    const txids = await signSendWait(fromChain, xfer, signer);

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
      from: fromChain.chain,
      to: to.chain,
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

    const sender = Wormhole.chainAddress(signer.chain(), signer.address());
    const xfer = await this._buildCompleteXfer(sender, receipt);
    const toChain = this.wh.getChain(receipt.to);
    const dstTxIds = await signSendWait<N, Chain>(toChain, xfer, signer);

    return {
      ...receipt,
      state: TransferState.DestinationInitiated,
      attestation: receipt.attestation as Required<AttestationReceipt<"ExecutorTokenBridge">>,
      destinationTxs: dstTxIds,
    };
  }

  async resume(txid: TransactionId): Promise<R> {
    const xfer = await TokenTransfer.from(this.wh, txid, 10 * 1000);
    if (xfer.transfer.protocol !== "ExecutorTokenBridge") {
      throw new Error("Can only resume ExecutorTokenBridge transfers");
    }
    return TokenTransfer.getReceipt(xfer);
  }

  public override async *track(receipt: R, timeout?: number) {
    for await (const r of TokenTransfer.track(this.wh, receipt, timeout)) {
      yield r as R;
    }
  }

  async _buildInitiateXfer(
    request: RouteTransferRequest<N>,
    sender: ChainAddress,
    recipient: ChainAddress,
    quote: Q,
  ): Promise<AsyncGenerator<UnsignedTransaction<N, Chain>>> {
    if (!quote.details) {
      throw new Error("Missing quote details");
    }

    const { executorQuote, referrerFee } = quote.details;

    if (!executorQuote) {
      throw new Error("ExecutorTokenBridge transfer requires an executorQuote");
    }

    // Set gas drop-off recipient if zero
    const gasDropOffInstruction = executorQuote.relayInstructions.requests.find(
      (r) => r.request.type === "GasDropOffInstruction",
    );
    if (
      gasDropOffInstruction &&
      gasDropOffInstruction.request.type === "GasDropOffInstruction" &&
      gasDropOffInstruction.request.recipient.equals(UniversalAddress.ZERO)
    ) {
      // @ts-ignore
      gasDropOffInstruction.request.recipient = recipient.address.toUniversalAddress();
    }

    const token = isTokenId(request.source.id) ? request.source.id.address : request.source.id;
    const senderAddress = toNative(sender.chain, sender.address.toString());
    const tb = await request.fromChain.getExecutorTokenBridge();
    return tb.transfer(
      senderAddress,
      recipient,
      token,
      sdkAmount.units(quote.params.normalizedParams.amount),
      executorQuote,
      referrerFee,
    );
  }

  async _buildCompleteXfer(
    sender: ChainAddress,
    receipt: R,
  ): Promise<AsyncGenerator<UnsignedTransaction<N, Chain>>> {
    const toChain = this.wh.getChain(receipt.to);
    const tb = await toChain.getExecutorTokenBridge();
    const senderAddress = toNative(sender.chain, sender.address.toString());
    const vaa = (receipt as AttestedTransferReceipt<AttestationReceipt<"ExecutorTokenBridge">>)
      .attestation.attestation as ExecutorTokenBridge.VAA;
    return tb.redeem(senderAddress, vaa);
  }

  async buildInitiateTransactions(
    request: RouteTransferRequest<N>,
    sender: ChainAddress,
    recipient: ChainAddress,
    quote: Q,
  ): Promise<UnsignedTransaction<N, Chain>[]> {
    return collectTransactions(await this._buildInitiateXfer(request, sender, recipient, quote));
  }

  async buildCompleteTransactions(
    sender: ChainAddress,
    receipt: R,
  ): Promise<UnsignedTransaction<N, Chain>[]> {
    if (!isAttested(receipt) && !isFailed(receipt)) {
      throw new Error("The source must be finalized in order to complete the transfer");
    }

    if (!receipt.attestation) {
      throw new Error("The receipt must have an attestation to complete the transfer");
    }

    return collectTransactions(await this._buildCompleteXfer(sender, receipt));
  }
}
