import { Chain, Network, amount } from "@wormhole-foundation/sdk-base";
import { ChainAddress, ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import { TransferQuote } from "../types";
import { Wormhole } from "../wormhole";
import { TokenDetails, getTokenDetails } from "./token";
import { Quote, ValidatedTransferParams } from "./types";

export class RouteTransferRequest<N extends Network> {
  from: ChainAddress;
  to: ChainAddress;
  source: TokenDetails;
  destination: TokenDetails;

  fromChain: ChainContext<N>;
  toChain: ChainContext<N>;

  private constructor(
    from: ChainAddress,
    to: ChainAddress,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
    source: TokenDetails,
    destination: TokenDetails,
  ) {
    this.from = from;
    this.fromChain = fromChain;
    this.to = to;
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
      dq.relayFee = {
        token: quote.relayFee.token,
        amount: amount.fromBaseUnits(quote.relayFee.amount, this.source.decimals),
      };
    }

    if (quote.destinationNativeGas) {
      const dstDecimals = await this.toChain.getDecimals("native");
      dq.destinationNativeGas = amount.fromBaseUnits(quote.destinationNativeGas, dstDecimals);
    }

    if (details) {
      dq.details = details;
    }

    return dq;
  }

  static async create<N extends Network, FC extends Chain, TC extends Chain>(
    wh: Wormhole<N>,
    params: {
      from: ChainAddress<FC>;
      to: ChainAddress<TC>;
      source: TokenId<FC>;
      destination: TokenId<TC>;
    },
    fromChain?: ChainContext<N, FC>,
    toChain?: ChainContext<N, TC>,
  ) {
    fromChain = fromChain ?? wh.getChain(params.from.chain);
    toChain = toChain ?? wh.getChain(params.to.chain);

    const sourceDetails = await getTokenDetails(fromChain, params.source);
    const destDetails = await getTokenDetails(toChain, params.destination);

    const rtr = new RouteTransferRequest(
      params.from,
      params.to,
      fromChain,
      toChain,
      sourceDetails,
      destDetails,
    );

    return rtr;
  }
}
