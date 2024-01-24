import {
  AttestationReceipt,
  Chain,
  ChainContext,
  Network,
  PorticoBridge,
  Signer,
  SourceInitiatedTransferReceipt,
  TokenId,
  TokenTransfer,
  TransactionId,
  TransferQuote,
  TransferState,
  Wormhole,
  canonicalAddress,
  chainToPlatform,
  contracts,
  isAttested,
  isSourceInitiated,
  isTokenId,
  resolveWrappedToken,
  signSendWait,
  tokens,
} from "../..";
import { AutomaticRoute, StaticRouteMethods } from "../route";
import { Receipt, TransferParams, ValidatedTransferParams, ValidationResult } from "../types";

export const SLIPPAGE_BPS = 15n; // 0.15%
export const BPS_PER_HUNDRED_PERCENT = 10000n;

export namespace PorticoRoute {
  export type Options = {};

  export interface Quote extends TransferQuote {
    quote: PorticoBridge.Quote;
  }

  export type NormalizedParams = {
    amount: bigint;

    canonicalSourceToken: TokenId;
    canonicalDestinationToken: TokenId;

    sourceToken: TokenId;
    destinationToken: TokenId;
  };

  export interface ValidatedParams extends ValidatedTransferParams<Options> {
    normalizedParams: NormalizedParams;
    quote?: Quote;
  }
}

type Q = PorticoRoute.Quote;
type OP = PorticoRoute.Options;
type R = Receipt<AttestationReceipt<"PorticoBridge">>;
type VP = PorticoRoute.ValidatedParams;

type VR = ValidationResult<OP>;
type TP = TransferParams<OP>;

export class AutomaticPorticoRoute<N extends Network>
  extends AutomaticRoute<N, OP, R, Q>
  implements StaticRouteMethods<typeof AutomaticPorticoRoute>
{
  NATIVE_GAS_DROPOFF_SUPPORTED = false;

  static readonly _supportedTokens = ["WETH", "WSTETH"];

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
        return tokens.filters.bySymbol(fromChain.config.tokenMap!, symbol) ?? [];
      })
      .flat()
      .filter((td) => {
        const localOrEth = !td.original || td.original === "Ethereum";
        const isAvax = chain === "Avalanche" && td.address === "native";
        return localOrEth && !isAvax;
      });

    return supported.map((td) => {
      if (td.address === "native") return { chain, address: "native" };
      return Wormhole.chainAddress(chain, td.address);
    });
  }

  static async supportedDestinationTokens<N extends Network>(
    sourceToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const tokenAddress = canonicalAddress(sourceToken);

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
    const redeemTokenDetails = tokens.filters.byAddress(
      toChain.config.tokenMap!,
      canonicalAddress(redeemToken),
    )!;

    // Find the local/native version of the same token by symbol
    const locallyRedeemable = (
      tokens.filters.bySymbol(toChain.config.tokenMap!, redeemTokenDetails.symbol) ?? []
    )
      .filter((td) => {
        return !td.original;
      })
      .map((td) => {
        switch (td.symbol) {
          case "ETH":
          case "WETH":
            return Wormhole.chainAddress(toChain.chain, td.address);
          case "WSTETH":
            return Wormhole.chainAddress(toChain.chain, td.address);
          default:
            throw new Error("Unknown symbol: " + redeemTokenDetails.symbol);
        }
      });

    return locallyRedeemable;
  }

  static isProtocolSupported<N extends Network>(
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): boolean {
    return fromChain.supportsPorticoBridge() && toChain.supportsPorticoBridge();
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
        chainToPlatform(this.request.from.chain) !== "Evm" ||
        chainToPlatform(this.request.to.chain) !== "Evm"
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
          amount: this.request.normalizeAmount(params.amount),
          canonicalSourceToken,
          canonicalDestinationToken,
          sourceToken,
          destinationToken,
        },
      };

      const quote = await this.quote(validatedParams);

      if (quote.destinationToken.amount < 0) {
        throw new Error(
          `Amount too low for slippage and fee, would result in negative destination amount (${quote.destinationToken.amount})`,
        );
      }

      validatedParams.quote = quote;

      return { valid: true, params: validatedParams };
    } catch (e) {
      return { valid: false, error: e as Error, params: params };
    }
  }

  async quote(params: VP): Promise<Q> {
    const swapAmounts = await this.quoteUniswap(params);

    const pb = await this.request.toChain.getPorticoBridge();

    const fee = await pb.quoteRelay(
      params.normalizedParams.canonicalDestinationToken.address,
      params.normalizedParams.destinationToken.address,
    );

    const quote: PorticoBridge.Quote = {
      swapAmounts,
      relayerFee: fee,
    };

    return {
      sourceToken: {
        token: params.normalizedParams.sourceToken,
        amount: params.normalizedParams.amount,
      },
      destinationToken: {
        token: params.normalizedParams.destinationToken,
        amount: quote.swapAmounts.minAmountFinish - fee,
      },
      relayFee: {
        token: params.normalizedParams.destinationToken,
        amount: fee,
      },
      quote,
    };
  }

  async initiate(sender: Signer<N>, params: VP) {
    const sourceToken = isTokenId(this.request.source.id)
      ? this.request.source.id.address
      : this.request.source.id;

    const destToken = isTokenId(this.request.destination!.id)
      ? this.request.destination?.id
      : this.request.destination!.id;

    const fromPorticoBridge = await this.request.fromChain.getPorticoBridge();
    const xfer = fromPorticoBridge.transfer(
      this.request.from.address,
      this.request.to,
      sourceToken,
      params.normalizedParams.amount,
      destToken!,
      params.quote!.quote,
    );

    const txids = await signSendWait(this.request.fromChain, xfer, sender);
    const receipt: SourceInitiatedTransferReceipt = {
      originTxs: txids,
      state: TransferState.SourceInitiated,
      from: this.request.from.chain,
      to: this.request.to.chain,
    };
    return receipt;
  }

  async *track(receipt: R, timeout?: number) {
    if (!isSourceInitiated(receipt)) throw new Error("Source must be initiated");

    const { txid } = receipt.originTxs[receipt.originTxs.length - 1]!;
    const vaa = await this.wh.getVaaByTxHash(txid, "TokenBridge:TransferWithPayload", timeout);
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
      params.normalizedParams.amount,
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
