import { filters, finality } from "@wormhole-foundation/sdk-base";
import type { StaticRouteMethods } from "../route.js";
import { AutomaticRoute } from "../route.js";
import type {
  Quote,
  QuoteResult,
  Receipt,
  TransferParams,
  ValidatedTransferParams,
  ValidationResult,
} from "../types.js";
import type {
  AttestationReceipt,
  Chain,
  ChainContext,
  Network,
  Signer,
  SourceInitiatedTransferReceipt,
  TokenId,
  TransactionId,
} from "./../../index.js";
import {
  PorticoBridge,
  TokenTransfer,
  TransferState,
  Wormhole,
  amount,
  canonicalAddress,
  contracts,
  isAttested,
  isSourceInitiated,
  resolveWrappedToken,
  signSendWait,
} from "./../../index.js";
import type { ChainAddress } from "@wormhole-foundation/sdk-definitions";
import type { RouteTransferRequest } from "../request.js";

export const SLIPPAGE_BPS = 15n; // 0.15%
export const MAX_SLIPPAGE_BPS = 100n; // 1%
export const BPS_PER_HUNDRED_PERCENT = 10_000n;

export namespace PorticoRoute {
  export type Options = {};

  export type NormalizedParams = {
    amount: amount.Amount;

    canonicalSourceToken: TokenId;
    canonicalDestinationToken: TokenId;

    sourceToken: TokenId;
    destinationToken: TokenId;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
  }
}

type OP = PorticoRoute.Options;
type R = Receipt<AttestationReceipt<"PorticoBridge">>;
type VP = PorticoRoute.ValidatedParams;

type VR = ValidationResult<OP>;
type TP = TransferParams<OP>;

type Q = Quote<OP, VP, PorticoBridge.Quote>;
type QR = QuoteResult<OP, VP, PorticoBridge.Quote>;

export class AutomaticPorticoRoute<N extends Network>
  extends AutomaticRoute<N, OP, VP, R>
  implements StaticRouteMethods<typeof AutomaticPorticoRoute>
{
  static NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static meta = {
    name: "AutomaticPortico",
  };

  static supportedNetworks(): Network[] {
    return ["Mainnet"];
  }

  static supportedChains(network: Network): Chain[] {
    if (contracts.porticoContractChains.has(network)) {
      return contracts.porticoContractChains.get(network)!;
    }
    return [];
  }

  static async supportedSourceTokens(fromChain: ChainContext<Network>): Promise<TokenId[]> {
    const pb = await fromChain.getPorticoBridge();
    return pb
      .supportedTokens()
      .filter(
        (t) =>
          !fromChain.config.tokenMap ||
          filters.byAddress(fromChain.config.tokenMap, canonicalAddress(t.token)),
      )
      .map((t) => t.token);
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const [, srcTokenAddress] = resolveWrappedToken(
      fromChain.network,
      fromChain.chain,
      sourceToken,
    );
    const tokenAddress = canonicalAddress(srcTokenAddress);

    // The highway token that will be used to bridge
    const pb = await fromChain.getPorticoBridge();
    const transferrableToken = await pb.getTransferrableToken(tokenAddress);
    // Make sure it exists on the destination chain
    try {
      await TokenTransfer.lookupDestinationToken(fromChain, toChain, transferrableToken);
    } catch {
      return [];
    }
    console.log(transferrableToken);

    // Find the destination token(s) in the same group
    const toPb = await toChain.getPorticoBridge();
    const tokens = toPb.supportedTokens();
    console.log("tokens", tokens);
    const group = pb.getTokenGroup(tokenAddress);
    console.log("group", group);
    return tokens
      .filter(
        (t) =>
          (t.group === group ||
            // ETH/WETH supports wrapping/unwrapping
            (t.group === "ETH" && group === "WETH") ||
            (t.group === "WETH" && group === "ETH")) &&
          (!toChain.config.tokenMap ||
            filters.byAddress(toChain.config.tokenMap, canonicalAddress(t.token))),
      )
      .map((t) => t.token);
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsPorticoBridge();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getDefaultOptions(): OP {
    return {};
  }

  async validate(request: RouteTransferRequest<N>, params: TP): Promise<VR> {
    try {
      if (
        !AutomaticPorticoRoute.isProtocolSupported(request.fromChain) ||
        !AutomaticPorticoRoute.isProtocolSupported(request.toChain)
      ) {
        throw new Error("Protocol not supported");
      }

      const { fromChain, toChain, source, destination } = request;
      const { network } = fromChain;

      // This may be "native" but we want the token that can actually be bridged
      const [, sourceToken] = resolveWrappedToken(network, fromChain.chain, source.id);
      const [, destinationToken] = resolveWrappedToken(network, toChain.chain, destination!.id);

      const fromPb = await fromChain.getPorticoBridge();
      const toPb = await toChain.getPorticoBridge();

      const canonicalSourceToken = await fromPb.getTransferrableToken(
        canonicalAddress(sourceToken),
      );

      const canonicalDestinationToken = await toPb.getTransferrableToken(
        canonicalAddress(destinationToken),
      );

      const validatedParams: VP = {
        amount: params.amount,
        options: params.options ?? this.getDefaultOptions(),
        normalizedParams: {
          amount: request.parseAmount(params.amount),
          canonicalSourceToken,
          canonicalDestinationToken,
          sourceToken,
          destinationToken,
        },
      };

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, error: e as Error, params: params };
    }
  }

  async quote(request: RouteTransferRequest<N>, params: VP): Promise<QR> {
    try {
      const swapAmounts = await this.fetchSwapQuote(request, params);

      // if the slippage is more than 100bps, we should throw an error
      // this likely means that the pools are unbalanced

      // TODO: what if we're comparing tokens with different decimals? e.g. 18 vs 6 (USDTbsc vs USDT)
      //const xferAmount = amount.units(params.normalizedParams.amount);
      //if (
      //  swapAmounts.minAmountFinish <
      //  xferAmount - (xferAmount * MAX_SLIPPAGE_BPS) / BPS_PER_HUNDRED_PERCENT
      //)
      //  throw new Error("Slippage too high");

      const pb = await request.toChain.getPorticoBridge();

      const fee = await pb.quoteRelay(
        params.normalizedParams.canonicalDestinationToken.address,
        params.normalizedParams.destinationToken.address,
      );

      const details: PorticoBridge.Quote = {
        swapAmounts,
        relayerFee: fee,
      };

      const destinationAmount = details.swapAmounts.minAmountFinish - fee;
      console.log(
        `Destination amount: ${details.swapAmounts.minAmountFinish} - ${fee} = ${destinationAmount}`,
      );

      if (destinationAmount < 0n) {
        return {
          success: false,
          error: new Error(
            `Amount too low for slippage and fee, would result in negative destination amount (${destinationAmount})`,
          ),
        };
      }

      return (await request.displayQuote(
        {
          sourceToken: {
            token: params.normalizedParams.sourceToken,
            amount: amount.units(params.normalizedParams.amount),
          },
          destinationToken: {
            token: params.normalizedParams.destinationToken,
            amount: details.swapAmounts.minAmountFinish - fee,
          },
          relayFee: {
            token: params.normalizedParams.destinationToken,
            amount: fee,
          },
          eta: finality.estimateFinalityTime(request.fromChain.chain),
        },
        params,
        details,
      )) as Q;
    } catch (e) {
      return {
        success: false,
        error: e as Error,
      };
    }
  }

  async initiate(request: RouteTransferRequest<N>, sender: Signer<N>, quote: Q, to: ChainAddress) {
    const { params, details } = quote;

    const sourceToken = request.source.id.address;
    const destToken = request.destination!.id;

    const fromPorticoBridge = await request.fromChain.getPorticoBridge();

    const xfer = fromPorticoBridge.transfer(
      Wormhole.parseAddress(sender.chain(), sender.address()),
      to,
      sourceToken,
      amount.units(params.normalizedParams.amount),
      destToken!,
      details!,
    );

    const txids = await signSendWait(request.fromChain, xfer, sender);
    const receipt: SourceInitiatedTransferReceipt = {
      originTxs: txids,
      state: TransferState.SourceInitiated,
      from: request.fromChain.chain,
      to: request.toChain.chain,
    };
    return receipt;
  }

  // TODO: beef this up
  async *track(receipt: R, timeout?: number) {
    if (!isSourceInitiated(receipt)) throw new Error("Source must be initiated");

    const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;
    const vaa = await this.wh.getVaa(txid, "TokenBridge:TransferWithPayload", timeout);
    if (!vaa) throw new Error("No VAA found for transaction: " + txid);

    const parsed = PorticoBridge.deserializePayload(vaa.payload.payload);
    yield { ...receipt, vaa, parsed };
  }

  async complete(signer: Signer<N>, receipt: R): Promise<TransactionId[]> {
    if (!isAttested(receipt)) throw new Error("Source must be attested");

    const toChain = await this.wh.getChain(receipt.to);
    const toPorticoBridge = await toChain.getPorticoBridge();
    const sender = Wormhole.chainAddress(signer.chain(), signer.address());
    const xfer = toPorticoBridge.redeem(sender.address, receipt.attestation.attestation);
    return await signSendWait(toChain, xfer, signer);
  }

  private async fetchSwapQuote(request: RouteTransferRequest<N>, params: VP) {
    const fromPb = await request.fromChain.getPorticoBridge();
    const xferAmount = amount.units(params.normalizedParams.amount);
    const tokenGroup = fromPb.getTokenGroup(canonicalAddress(params.normalizedParams.sourceToken));
    const startQuote = await fromPb.quoteSwap(
      params.normalizedParams.sourceToken.address,
      params.normalizedParams.canonicalSourceToken.address,
      tokenGroup,
      xferAmount,
    );
    const startSlippage = (startQuote * SLIPPAGE_BPS) / BPS_PER_HUNDRED_PERCENT;

    if (startSlippage >= startQuote) throw new Error("Start slippage too high");

    const toPb = await request.toChain.getPorticoBridge();
    const minAmountStart = startQuote - startSlippage;
    const finishQuote = await toPb.quoteSwap(
      params.normalizedParams.canonicalDestinationToken.address,
      params.normalizedParams.destinationToken.address,
      tokenGroup,
      // TODO: I think we need to scale this by the decimals of the token
      // on the destination chain
      minAmountStart,
    );
    const finishSlippage = (finishQuote * SLIPPAGE_BPS) / BPS_PER_HUNDRED_PERCENT;

    if (finishSlippage >= finishQuote) throw new Error("Finish slippage too high");

    const minAmountFinish = finishQuote - finishSlippage;

    return {
      minAmountStart: minAmountStart,
      minAmountFinish: minAmountFinish,
    };
  }
}
