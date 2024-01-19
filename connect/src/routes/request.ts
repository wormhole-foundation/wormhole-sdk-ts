import { Network, normalizeAmount, displayAmount, tokens } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  TokenId,
  canonicalAddress,
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
      source: TokenId | "native";
      destination?: TokenId | "native";
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
  id: TokenId | "native";
  decimals: number;
  // If this is a native gas token, the native wrapped token equivalent
  // for bridging
  nativeWrapped?: TokenId;
  // If this is a wrapped token, the original chain and token
  original?: TokenId;
  // Ticker symbol
  symbol?: string;
  // Logo URL
  logo?: string;
}

async function getTokenDetails<N extends Network>(
  chain: ChainContext<N>,
  token: TokenId | "native",
): Promise<TokenDetails> {
  const tokenAddress = isTokenId(token) ? canonicalAddress(token) : token;
  const _token = tokens.getTokenByAddress(chain.network, chain.chain, tokenAddress);

  const decimals = _token
    ? _token.decimals
    : isTokenId(token)
    ? Number(await chain.getDecimals(token.address))
    : chain.config.nativeTokenDecimals;

  const symbol = _token ? _token.symbol : undefined;

  const td: TokenDetails = {
    id: token,
    decimals: decimals,
    nativeWrapped: token === "native" ? await chain.getNativeWrappedTokenId() : undefined,
    symbol,

    // TODO: find other details
  };

  return td;
}
