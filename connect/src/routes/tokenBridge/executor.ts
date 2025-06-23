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
import { SignedQuote } from "@wormhole-foundation/sdk-definitions";

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
    payload?: Uint8Array;
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
type R = TransferReceipt<AttestationReceipt<"TokenBridge">>;

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
    return { payload: undefined, nativeGas: 0.0 };
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
      const dstTbExec = await request.toChain.getTokenBridgeExecutor();
      let { msgValue, gasLimit } = await dstTbExec.estimateMsgValueAndGasLimit(recipient);

      if (this.staticConfig.perTokenOverrides) {
        const dstTokenAddress = canonicalAddress(request.destination.id);
        const override =
          this.staticConfig.perTokenOverrides[request.destination.id.chain]?.[dstTokenAddress];
        if (override?.gasLimit !== undefined) {
          gasLimit = override.gasLimit;
        }
      }

      const relayRequests = [];

      // Add the gas instruction
      relayRequests.push({
        request: {
          type: "GasInstruction" as const,
          gasLimit,
          msgValue,
        },
      });

      // Add the gas drop-off instruction if applicable
      // TODO: if Solana ATA doesn't exist, prolly need to add a gas drop-off instruction
      if (dropOff > 0n) {
        relayRequests.push({
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

      const relayInstructions = serializeLayout(relayInstructionsLayout, {
        requests: relayRequests,
      });

      const executorQuote = await this.wh.getExecutorQuote(
        request.fromChain.chain,
        request.toChain.chain,
        encoding.hex.encode(relayInstructions, true),
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
      };

      // TODO: relay fee and stuff
      const quote = await request.displayQuote(
        await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
          token: request.source.id,
          amount: sdkAmount.units(params.normalizedParams.amount),
          // ...params.options,
        }),
        params,
        details,
      );

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

  // TODO: why need this..
  toTransferDetails(
    request: RouteTransferRequest<N>,
    params: Vp,
    from: ChainAddress,
    to: ChainAddress,
  ): TokenTransferDetails {
    return {
      from,
      to,
      token: request.source.id,
      amount: sdkAmount.units(params.normalizedParams.amount),
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
