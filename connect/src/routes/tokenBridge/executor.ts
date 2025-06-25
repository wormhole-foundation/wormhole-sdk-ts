import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import {
  amount as sdkAmount,
  contracts,
  deserializeLayout,
  encoding,
  serializeLayout,
  toChainId,
} from "@wormhole-foundation/sdk-base";
import {
  canonicalAddress,
  relayInstructionsLayout,
  signedQuoteLayout,
  UniversalAddress,
  type ChainAddress,
  type ChainContext,
  type SignedQuote,
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
import { RelayStatus } from "../../executor-api.js";
import { routes, signSendWait } from "../../index.js";
import { toNative } from "@wormhole-foundation/sdk-definitions";
import { TokenBridgeExecutor } from "@wormhole-foundation/sdk-definitions";
import { RelayInstructions } from "@wormhole-foundation/sdk-definitions";

export namespace TokenBridgeExecutorRoute {
  export type Config = {
    // Referrer Fee in *tenths* of basis points - e.g. 10 = 1 basis point (0.01%)
    referrerFeeDbps?: bigint;
    // The address to which the referrer fee will be sent
    // TODO: Platform instead of Chain?
    referrerAddresses?: Partial<Record<Chain, string>>;
    perTokenOverrides?: Partial<
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
    >;
  };

  export type Options = {
    nativeGas?: number;
  };

  export type NormalizedParams = {
    amount: sdkAmount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }

  export type QuoteDetails = {
    signedQuote: SignedQuote;
    estimatedCost: bigint;
    relayInstructions: RelayInstructions;
    // TODO: referrerFee stuff
  };
}

type Op = TokenBridgeExecutorRoute.Options;
type Vp = TokenBridgeExecutorRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type D = TokenBridgeExecutorRoute.QuoteDetails;
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
      const capabilities = await this.wh.getExecutorCapabilities();

      const srcCapabilities = capabilities[toChainId(request.fromChain.chain)];
      if (!srcCapabilities) {
        throw new Error(
          `No executor capabilities found for source chain ${request.fromChain.chain}`,
        );
      }

      const dstCapabilities = capabilities[toChainId(request.toChain.chain)];
      if (!dstCapabilities || !dstCapabilities.requestPrefixes.includes("ERV1")) {
        throw new Error(
          `No executor capabilities found for destination chain ${request.toChain.chain}`,
        );
      }

      const gasDropOffLimit = BigInt(dstCapabilities.gasDropOffLimit);
      const dropOff =
        params.options.nativeGas && gasDropOffLimit > 0n
          ? (BigInt(Math.round(params.options.nativeGas * 100)) * gasDropOffLimit) / 100n
          : 0n;

      const { recipient } = request;
      const dstTb = await request.toChain.getTokenBridgeExecutor();
      let { msgValue, gasLimit } = await dstTb.estimateMsgValueAndGasLimit(recipient);

      if (this.staticConfig.perTokenOverrides) {
        const dstTokenAddress = canonicalAddress(request.destination.id);
        const override =
          this.staticConfig.perTokenOverrides[request.destination.id.chain]?.[dstTokenAddress];
        if (override?.gasLimit !== undefined) {
          gasLimit = override.gasLimit;
        }
      }

      const instructions = [];

      // Add the gas instruction
      instructions.push({
        request: {
          type: "GasInstruction" as const,
          gasLimit,
          msgValue,
        },
      });

      // Add the gas drop-off instruction if applicable
      // TODO: if Solana ATA doesn't exist, prolly need to add a gas drop-off instruction
      if (dropOff > 0n) {
        instructions.push({
          request: {
            type: "GasDropOffInstruction" as const,
            dropOff,
            // If the recipient is undefined (e.g. the user hasn’t connected their wallet yet),
            // we temporarily use a dummy address to fetch a quote.
            // The recipient address is validated later in the `initiate` method, which will throw if it's still missing.
            recipient: recipient
              ? recipient.address.toUniversalAddress()
              : new UniversalAddress(new Uint8Array(32)),
          },
        });
      }

      const relayInstructions: RelayInstructions = {
        requests: instructions,
      };

      const relayInstructionsBytes = serializeLayout(relayInstructionsLayout, relayInstructions);

      const executorQuote = await this.wh.getExecutorQuote(
        request.fromChain.chain,
        request.toChain.chain,
        encoding.hex.encode(relayInstructionsBytes, true),
      );

      if (!executorQuote.estimatedCost) {
        throw new Error("No estimated cost");
      }

      const estimatedCost = BigInt(executorQuote.estimatedCost);

      // const signedQuoteBytes = encoding.hex.decode(quote.signedQuote);
      const signedQuote = deserializeLayout(
        signedQuoteLayout,
        encoding.hex.decode(executorQuote.signedQuote),
      );

      const details: D = {
        signedQuote,
        estimatedCost,
        relayInstructions,
      };

      // TODO: relay fee and stuff
      const quote = await request.displayQuote(
        await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
          token: request.source.id,
          amount: sdkAmount.units(params.normalizedParams.amount),
          // ...params.options,
          protocol: "TokenBridgeExecutor",
        }),
        params,
        details,
      );
      quote.expires = signedQuote.quote.expiryTime;

      return quote;

      //return {
      //  signedQuote: signedQuoteBytes,
      //  relayInstructions: relayInstructions,
      //  estimatedCost,
      //  payeeAddress: signedQuote.quote.payeeAddress,
      //  referrer,
      //  referrerFee,
      //  remainingAmount,
      //  referrerFeeDbps,
      //  expires: signedQuote.quote.expiryTime,
      //  gasDropOff: dropOff,
      //};

      //return request.displayQuote(
      //  await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
      //    token: request.source.id,
      //    amount: amount.units(params.normalizedParams.amount),
      //    // ...params.options,
      //  }),
      //  params,
      //);
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
    return TokenTransfer.getReceipt(xfer) as R;
  }

  public override async *track(receipt: R, timeout?: number) {
    // Check if the relay was successful or failed
    if (isAttested(receipt) && !isFailed(receipt)) {
      const [txStatus] = await this.wh.getExecutorTxStatus(
        receipt.originTxs.at(-1)!.txid,
        receipt.from,
      );
      if (!txStatus) throw new Error("No transaction status found");

      const relayStatus = txStatus.status;
      if (
        relayStatus === RelayStatus.Failed || // this could happen if simulation fails
        relayStatus === RelayStatus.Underpaid || // only happens if you don't pay at least the costEstimate
        relayStatus === RelayStatus.Unsupported || // capabilities check didn't pass
        relayStatus === RelayStatus.Aborted // An unrecoverable error indicating the attempt should stop (bad data, pre-flight checks failed, or chain-specific conditions)
      ) {
        receipt = {
          ...receipt,
          state: TransferState.Failed,
          error: new routes.RelayFailedError(`Relay failed with status: ${relayStatus}`),
        };
        yield receipt;
        return;
      }
    }

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
    if (!quote.details) throw new Error("Quote details are missing");

    const { signedQuote, relayInstructions, estimatedCost } = quote.details;

    return {
      from,
      to,
      token: request.source.id,
      amount: sdkAmount.units(params.normalizedParams.amount),
      protocol: "TokenBridgeExecutor",
      executorParams: {
        signedQuote,
        relayInstructions,
        estimatedCost,
      },
      // Note: We intentionally don't set automatic: true here
      // so that tokenTransfer.ts uses the manual logic
      // ...params.options,
    };
  }

  // TODO: token bridge trims dust. does it refund it?
  static calculateReferrerFee(
    _amount: sdkAmount.Amount,
    dBps: bigint,
  ): { referrerFee: bigint; remainingAmount: bigint } {
    const MAX_U16 = 65_535n;
    if (dBps > MAX_U16) {
      throw new Error("dBps exceeds max u16");
    }
    const amount = sdkAmount.units(_amount);
    let remainingAmount: bigint = amount;
    let referrerFee: bigint = 0n;
    if (dBps > 0) {
      referrerFee = (amount * dBps) / 100_000n;
      //// The NttManagerWithExecutor trims the fee before subtracting it from the amount
      //const trimmedFee = NttRoute.trimAmount(
      //  sdkAmount.fromBaseUnits(referrerFee, _amount.decimals),
      //  destinationTokenDecimals,
      //);
      remainingAmount = amount - referrerFee;
    }
    return { referrerFee, remainingAmount };
  }
}
