import { Network, displayAmount, normalizeAmount, tokens } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  TokenId,
  canonicalAddress,
  isNative,
  isTokenId,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";

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

export interface TokenDetails {
  id: TokenId;
  decimals: number;
  symbol?: tokens.TokenSymbol;
  wrapped?: TokenId;
}

async function getTokenDetails<N extends Network>(
  chain: ChainContext<N>,
  token: TokenId,
): Promise<TokenDetails> {
  const address = isTokenId(token) ? canonicalAddress(token) : token;

  const details = chain.config.tokenMap
    ? tokens.filters.byAddress(chain.config.tokenMap!, address)
    : undefined;

  const symbol = details ? details.symbol : undefined;
  const wrapped = isNative(token.address) ? await chain.getNativeWrappedTokenId() : undefined;
  const decimals = Number(await chain.getDecimals(isTokenId(token) ? token.address : token));

  return {
    id: token,
    decimals,
    wrapped,
    symbol,
  };
}
