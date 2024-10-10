import type { Chain, Network } from "@wormhole-foundation/sdk-base";
import { amount } from "@wormhole-foundation/sdk-base";
import type { ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import type { TransferQuote } from "../types.js";
import type { Wormhole } from "../wormhole.js";
import type { TokenDetails } from "./token.js";
import { getTokenDetails } from "./token.js";
import type { Quote, ValidatedTransferParams } from "./types.js";

export class RouteTransferRequest<N extends Network> {
  source: TokenDetails;
  destination: TokenDetails;

  fromChain: ChainContext<N>;
  toChain: ChainContext<N>;

  private constructor(
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
    source: TokenDetails,
    destination: TokenDetails,
  ) {
    this.fromChain = fromChain;
    this.toChain = toChain;
    this.source = source;
    this.destination = destination;
  }

  parseAmount(amt: string): amount.Amount {
    return amount.parse(amt, this.source.decimals);
  }

  amountFromBaseUnits(amt: bigint): amount.Amount {
    return amount.fromBaseUnits(amt, this.source.decimals);
  }

  async displayQuote<OP, VP extends ValidatedTransferParams<OP> = ValidatedTransferParams<OP>>(
    quote: TransferQuote,
    params: VP,
    details?: any,
  ): Promise<Quote<OP, VP>> {
    let dq: Quote<OP, VP> = {
      success: true,
      sourceToken: {
        token: quote.sourceToken.token,
        amount: amount.fromBaseUnits(quote.sourceToken.amount, this.source.decimals),
      },
      destinationToken: {
        token: quote.destinationToken.token,
        amount: amount.fromBaseUnits(quote.destinationToken.amount, this.destination.decimals),
      },
      params,
    };

    if (quote.relayFee) {
      const relayFeeChain =
        quote.relayFee.token.chain === this.fromChain.chain ? this.fromChain : this.toChain;
      const relayFeeDecimals = await relayFeeChain.getDecimals(quote.relayFee.token.address);

      dq.relayFee = {
        token: quote.relayFee.token,
        amount: amount.fromBaseUnits(quote.relayFee.amount, relayFeeDecimals),
      };
    }

    if (quote.destinationNativeGas) {
      const dstDecimals = await this.toChain.getDecimals("native");
      dq.destinationNativeGas = amount.fromBaseUnits(quote.destinationNativeGas, dstDecimals);
    }

    if (quote.warnings && quote.warnings.length > 0) {
      dq.warnings = [...quote.warnings];
    }

    dq.eta = quote.eta;

    if (details) {
      dq.details = details;
    }

    return dq;
  }

  static async create<N extends Network, FC extends Chain, TC extends Chain>(
    wh: Wormhole<N>,
    params: {
      source: TokenId<FC>;
      destination: TokenId<TC>;
    },
    fromChain?: ChainContext<N, FC>,
    toChain?: ChainContext<N, TC>,
  ) {
    fromChain = fromChain ?? wh.getChain(params.source.chain);
    toChain = toChain ?? wh.getChain(params.destination.chain);

    const sourceDetails = await getTokenDetails(fromChain, params.source);
    const destDetails = await getTokenDetails(toChain, params.destination);

    const rtr = new RouteTransferRequest(fromChain, toChain, sourceDetails, destDetails);

    return rtr;
  }
}
