import { Network, normalizeAmount } from "@wormhole-foundation/sdk-base";
import {
  ChainAddress,
  ChainContext,
  TokenId,
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
    return normalizeAmount(amount, this.source.decimals);
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

    const sourceDetails = await getTokenDetails(params.source, fromChain);

    const destDetails = params.destination
      ? await getTokenDetails(params.destination, toChain)
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
  decimals: bigint;
  // If this is a native gas token, the native wrapped token equivalent
  // for bridging
  nativeWrapped?: TokenId;
  // If this is a wrapped token, the original chain and token
  original?: TokenId;
  // Full name
  name?: string;
  // Ticker symbol
  symbol?: string;
  // Logo URL
  logo?: string;
}

async function getTokenDetails<N extends Network>(
  token: TokenId | "native",
  chain: ChainContext<N>,
): Promise<TokenDetails> {
  const decimals = isTokenId(token)
    ? await chain.getDecimals(token.address)
    : BigInt(chain.config.nativeTokenDecimals);

  const td: TokenDetails = {
    id: token,
    decimals: decimals,
    nativeWrapped: token === "native" ? await chain.getNativeWrappedTokenId() : undefined,
    // TODO: find other details
  };

  return td;
}
