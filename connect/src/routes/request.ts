import { Network, amountFromBaseUnits, displayAmount } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  TokenId,
  isSameToken,
} from "@wormhole-foundation/sdk-definitions";
import { Amount, parseAmount } from "@wormhole-foundation/sdk-base";
import { TransferQuote } from "../types";
import { Wormhole } from "../wormhole";
import { TokenDetails, getTokenDetails } from "./token";
import { Quote } from "./types";

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

  parseAmount(amt: string): Amount {
    return parseAmount(amt, this.source.decimals);
  }

  amountFromBaseUnits(amt: bigint): Amount {
    return amountFromBaseUnits(amt, this.source.decimals);
  }

  displayQuote(quote: TransferQuote): Quote {
    let dq: Quote = {
      sourceToken: {
        token: quote.sourceToken.token,
        amount: displayAmount(amountFromBaseUnits(quote.sourceToken.amount, this.source.decimals)),
      },
      destinationToken: {
        token: quote.destinationToken.token,
        amount: displayAmount(
          amountFromBaseUnits(quote.destinationToken.amount, this.destination.decimals),
        ),
      },
    };

    if (quote.relayFee) {
      let amount = isSameToken(quote.relayFee.token, quote.sourceToken.token)
        ? displayAmount(amountFromBaseUnits(quote.sourceToken.amount, this.source.decimals))
        : displayAmount(
            amountFromBaseUnits(quote.destinationToken.amount, this.destination.decimals),
          );

      dq.relayFee = {
        token: quote.relayFee.token,
        amount,
      };
    }

    if (quote.destinationNativeGas) {
      dq.destinationNativeGas = displayAmount(
        amountFromBaseUnits(quote.destinationNativeGas, this.source.decimals),
      );
    }

    return dq;
  }

  static async create<N extends Network>(
    wh: Wormhole<N>,
    params: {
      from: ChainAddress;
      to: ChainAddress;
      source: TokenId;
      destination: TokenId;
    },
    fromChain?: ChainContext<N>,
    toChain?: ChainContext<N>,
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
