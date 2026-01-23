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
import { TransferState, isAttested } from "../../types.js";
import { Wormhole } from "../../wormhole.js";
import type { StaticRouteMethods } from "../route.js";
import { ManualRoute } from "../route.js";
import type {
  Quote,
  QuoteResult,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type { RouteTransferRequest } from "../request.js";
import { chainToPlatform } from "@wormhole-foundation/sdk-base";

export namespace TokenBridgeRoute {
  export type Options = {
    payload?: Uint8Array;
  };

  export type NormalizedParams = {
    amount: amount.Amount;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type Op = TokenBridgeRoute.Options;
type Vp = TokenBridgeRoute.ValidatedParams;

type Tp = TransferParams<Op>;
type Vr = ValidationResult<Op>;

type QR = QuoteResult<Op, Vp>;
type Q = Quote<Op, Vp>;
type R = TransferReceipt<AttestationReceipt<"TokenBridge">>;

export class TokenBridgeRoute<N extends Network>
  extends ManualRoute<N, Op, Vp, R>
  implements StaticRouteMethods<typeof TokenBridgeRoute>
{
  static meta = {
    name: "ManualTokenBridge",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet", "Testnet"];
  }
  // get the list of chains this route supports
  static supportedChains(network: Network): Chain[] {
    return contracts.tokenBridgeChains(network);
  }

  // get the list of destination tokens that may be received on the destination chain
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
    return { payload: undefined };
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

    // Prevent transfers to/from SVM chains if the destination token is Token2022
    // except when using ExecutorTokenBridge
    // Attempting to manually redeem Token2022 tokens will fail if recipient account
    // has the immutableOwner extension, so just disable such transfers here
    // Executor route creates temporary account without the extension
    if (chainToPlatform(request.fromChain.chain) === "Solana") {
      const isToken2022 = await request.fromChain.isToken2022(request.source.id.address);
      if (isToken2022) {
        return {
          valid: false,
          params,
          error: new Error(
            "Transfers of Token-2022 assets from SVM chains are not supported via the Manual Token Bridge route. Please use the Executor Token Bridge route instead.",
          ),
        };
      }
    }
    if (chainToPlatform(request.toChain.chain) === "Solana") {
      const isToken2022 = await request.toChain.isToken2022(request.destination.id.address);
      if (isToken2022) {
        return {
          valid: false,
          params,
          error: new Error(
            "Transfers of Token-2022 assets to SVM chains are not supported via the Manual Token Bridge route. Please use the Executor Token Bridge route instead.",
          ),
        };
      }
    }

    const amt = amount.parse(params.amount, request.source.decimals);

    const validatedParams: Vp = {
      amount: params.amount,
      normalizedParams: { amount: amt },
      options: {},
    };

    return { valid: true, params: validatedParams };
  }

  async quote(request: RouteTransferRequest<N>, params: Vp): Promise<QR> {
    try {
      return request.displayQuote(
        await TokenTransfer.quoteTransfer(this.wh, request.fromChain, request.toChain, {
          token: request.source.id,
          amount: amount.units(params.normalizedParams.amount),
          protocol: "TokenBridge",
          ...params.options,
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

  async complete(signer: Signer, receipt: R): Promise<R> {
    if (!isAttested(receipt))
      throw new Error("The source must be finalized in order to complete the transfer");
    const toChain = this.wh.getChain(receipt.to);
    const dstTxIds = await TokenTransfer.redeem<N>(
      toChain,
      receipt.attestation.attestation as TokenTransfer.VAA,
      signer,
    );

    return {
      ...receipt,
      state: TransferState.DestinationInitiated,
      destinationTxs: dstTxIds,
    };
  }

  async resume(txid: TransactionId): Promise<R> {
    const xfer = await TokenTransfer.from(this.wh, txid, 10 * 1000);
    if (xfer.transfer.protocol !== "TokenBridge") {
      throw new Error("Transfer is not a TokenBridge transfer");
    }
    return TokenTransfer.getReceipt(xfer);
  }

  public override async *track(receipt: R, timeout?: number) {
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
      protocol: "TokenBridge",
      token: request.source.id,
      amount: amount.units(params.normalizedParams.amount),
      ...params.options,
    };
  }
}
