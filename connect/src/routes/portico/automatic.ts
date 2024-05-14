import { filters } from "@wormhole-foundation/sdk-base";
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
  chainToPlatform,
  contracts,
  isAttested,
  isNative,
  isSourceInitiated,
  resolveWrappedToken,
  signSendWait,
} from "./../../index.js";
import { ChainAddress } from "@wormhole-foundation/sdk-definitions";

export const SLIPPAGE_BPS = 15n; // 0.15%
export const BPS_PER_HUNDRED_PERCENT = 10000n;

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
  NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static meta = {
    name: "AutomaticPortico",
  };

  private static _supportedTokens = ["WETH", "WSTETH"];

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
    const { chain } = fromChain;
    const supported = this._supportedTokens
      .map((symbol) => {
        return filters.bySymbol(fromChain.config.tokenMap!, symbol) ?? [];
      })
      .flat()
      .filter((td) => {
        const localOrEth = !td.original || td.original === "Ethereum";
        const isAvax = chain === "Avalanche" && isNative(td.address);
        return localOrEth && !isAvax;
      });

    return supported.map((td) => Wormhole.tokenId(chain, td.address));
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

    // The token that will be used to bridge
    const pb = await fromChain.getPorticoBridge();
    const transferrableToken = pb.getTransferrableToken(tokenAddress);

    // The tokens that _will_ be received on redemption
    const redeemToken = await TokenTransfer.lookupDestinationToken(
      fromChain,
      toChain,
      transferrableToken,
    );

    // Grab the symbol for the token that gets redeemed
    const redeemTokenDetails = filters.byAddress(
      toChain.config.tokenMap!,
      canonicalAddress(redeemToken),
    )!;

    // Find the local/native version of the same token by symbol
    const locallyRedeemable = (
      filters.bySymbol(toChain.config.tokenMap!, redeemTokenDetails.symbol) ?? []
    )
      .filter((td) => {
        return !td.original;
      })
      .map((td) => {
        switch (td.symbol) {
          case "ETH":
          case "WETH":
            return Wormhole.tokenId(toChain.chain, td.address);
          case "WSTETH":
            return Wormhole.tokenId(toChain.chain, td.address);
          default:
            throw new Error("Unknown symbol: " + redeemTokenDetails.symbol);
        }
      });

    return locallyRedeemable;
  }

  static isProtocolSupported<N extends Network>(chain: ChainContext<N>): boolean {
    return chain.supportsPorticoBridge();
  }

  async isAvailable(): Promise<boolean> {
    // TODO:
    return true;
  }

  getDefaultOptions(): OP {
    return {};
  }

  async validate(params: TP): Promise<VR> {
    try {
      if (
        chainToPlatform(this.request.fromChain.chain) !== "Evm" ||
        chainToPlatform(this.request.toChain.chain) !== "Evm"
      ) {
        throw new Error("Only EVM chains are supported");
      }

      const { fromChain, toChain, source, destination } = this.request;
      const { network } = fromChain;

      // This may be "native" but we want the token that can actually be bridged
      const [, sourceToken] = resolveWrappedToken(network, fromChain.chain, source.id);
      const [, destinationToken] = resolveWrappedToken(network, toChain.chain, destination!.id);

      const fromPb = await fromChain.getPorticoBridge();
      const toPb = await toChain.getPorticoBridge();

      const canonicalSourceToken = fromPb.getTransferrableToken(canonicalAddress(sourceToken));

      const canonicalDestinationToken = toPb.getTransferrableToken(
        canonicalAddress(destinationToken),
      );

      const validatedParams: VP = {
        amount: params.amount,
        options: params.options ?? this.getDefaultOptions(),
        normalizedParams: {
          amount: this.request.parseAmount(params.amount),
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

  async quote(params: VP): Promise<QR> {
    try {
      const swapAmounts = await this.quoteUniswap(params);

      const pb = await this.request.toChain.getPorticoBridge();

      const fee = await pb.quoteRelay(
        params.normalizedParams.canonicalDestinationToken.address,
        params.normalizedParams.destinationToken.address,
      );

      const details: PorticoBridge.Quote = {
        swapAmounts,
        relayerFee: fee,
      };

      let destinationAmount = details.swapAmounts.minAmountFinish - fee;

      if (Number(destinationAmount) < 0) {
        return {
          success: false,
          error: new Error(
            `Amount too low for slippage and fee, would result in negative destination amount (${destinationAmount})`,
          ),
        };
      }

      return (await this.request.displayQuote(
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

  async initiate(sender: Signer<N>, quote: Q, to: ChainAddress) {
    const { params, details } = quote;

    const sourceToken = this.request.source.id.address;
    const destToken = this.request.destination!.id;

    const fromPorticoBridge = await this.request.fromChain.getPorticoBridge();

    const xfer = fromPorticoBridge.transfer(
      Wormhole.parseAddress(sender.chain(), sender.address()),
      to,
      sourceToken,
      amount.units(params.normalizedParams.amount),
      destToken!,
      details!,
    );

    const txids = await signSendWait(this.request.fromChain, xfer, sender);
    const receipt: SourceInitiatedTransferReceipt = {
      originTxs: txids,
      state: TransferState.SourceInitiated,
      from: this.request.fromChain.chain,
      to: this.request.toChain.chain,
    };
    return receipt;
  }

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

    const toPorticoBridge = await this.request.toChain.getPorticoBridge();
    const sender = Wormhole.chainAddress(signer.chain(), signer.address());
    const xfer = toPorticoBridge.redeem(sender.address, receipt.attestation.attestation);
    return await signSendWait(this.request.toChain, xfer, signer);
  }

  private async quoteUniswap(params: VP) {
    const fromPorticoBridge = await this.request.fromChain.getPorticoBridge();
    const startQuote = await fromPorticoBridge.quoteSwap(
      params.normalizedParams.sourceToken.address,
      params.normalizedParams.canonicalSourceToken.address,
      amount.units(params.normalizedParams.amount),
    );
    const startSlippage = (startQuote * SLIPPAGE_BPS) / BPS_PER_HUNDRED_PERCENT;

    if (startSlippage >= startQuote) throw new Error("Start slippage too high");

    const toPorticoBridge = await this.request.toChain.getPorticoBridge();
    const minAmountStart = startQuote - startSlippage;
    const finishQuote = await toPorticoBridge.quoteSwap(
      params.normalizedParams.canonicalDestinationToken.address,
      params.normalizedParams.destinationToken.address,
      minAmountStart,
    );
    const finishSlippage = (finishQuote * SLIPPAGE_BPS) / BPS_PER_HUNDRED_PERCENT;

    if (finishSlippage >= finishQuote) throw new Error("Finish slippage too high");

    const minAmountFinish = finishQuote - finishSlippage;
    const amountFinishQuote = await toPorticoBridge.quoteSwap(
      params.normalizedParams.canonicalDestinationToken.address,
      params.normalizedParams.destinationToken.address,
      startQuote, // no slippage
    );
    // the expected receive amount is the amount out from the swap
    // minus 5bps slippage
    const amountFinishSlippage = (amountFinishQuote * 5n) / BPS_PER_HUNDRED_PERCENT;
    if (amountFinishSlippage >= amountFinishQuote)
      throw new Error("Amount finish slippage too high");

    const amountFinish = amountFinishQuote - amountFinishSlippage;
    if (amountFinish <= minAmountFinish) throw new Error("Amount finish too low");

    return {
      minAmountStart: minAmountStart,
      minAmountFinish: minAmountFinish,
      amountFinish: amountFinish,
    };
  }
}
