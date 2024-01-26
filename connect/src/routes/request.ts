import { Network, displayAmount, normalizeAmount } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  TokenId,
  isSameToken,
} from "@wormhole-foundation/sdk-definitions";
import { TransferQuote } from "../types";
import { Wormhole } from "../wormhole";
import { TokenDetails, getTokenDetails } from "./token";
import { Quote } from "./types";

export class RouteTransferRequest<N extends Network> {
  from: ChainAddress;
  to: ChainAddress;
  source: TokenDetails;
  destination?: TokenDetails;

  fromChain: ChainContext<N>;
  toChain: ChainContext<N>;

  private constructor(
    from: ChainAddress,
    to: ChainAddress,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
    source: TokenDetails,
    destination?: TokenDetails,
  ) {
    this.from = from;
    this.fromChain = fromChain;
    this.to = to;
    this.toChain = toChain;
    this.source = source;
    this.destination = destination;
  }

  normalizeAmount(amount: string): bigint {
    return normalizeAmount(amount, BigInt(this.source.decimals));
  }

  displayAmount(amount: bigint): string {
    return displayAmount(amount, BigInt(this.source.decimals), BigInt(this.source.decimals));
  }

  displayQuote(quote: TransferQuote): Quote {
    let dq: Quote = {
      sourceToken: {
        token: quote.sourceToken.token,
        amount: displayAmount(
          quote.sourceToken.amount,
          BigInt(this.source.decimals),
          BigInt(this.source.decimals),
        ),
      },
      destinationToken: {
        token: quote.destinationToken.token,
        amount: displayAmount(
          quote.destinationToken.amount,
          BigInt(this.destination!.decimals),
          BigInt(this.destination!.decimals),
        ),
      },
    };

    if (quote.relayFee) {
      let amount = isSameToken(quote.relayFee.token, quote.sourceToken.token)
        ? displayAmount(
            quote.sourceToken.amount,
            BigInt(this.source.decimals),
            BigInt(this.source.decimals),
          )
        : displayAmount(
            quote.destinationToken.amount,
            BigInt(this.destination!.decimals),
            BigInt(this.destination!.decimals),
          );

      dq.relayFee = {
        token: quote.relayFee.token,
        amount,
      };
    }

    if (quote.destinationNativeGas) {
      dq.destinationNativeGas = displayAmount(
        quote.destinationNativeGas,
        BigInt(this.destination!.decimals),
        BigInt(this.destination!.decimals),
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
      destination?: TokenId;
    },
    fromChain?: ChainContext<N>,
    toChain?: ChainContext<N>,
  ) {
    fromChain = fromChain ?? wh.getChain(params.from.chain);
    toChain = toChain ?? wh.getChain(params.to.chain);

    const sourceDetails = await getTokenDetails(fromChain, params.source);

    const destDetails = params.destination
      ? await getTokenDetails(toChain, params.destination)
      : undefined;

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
