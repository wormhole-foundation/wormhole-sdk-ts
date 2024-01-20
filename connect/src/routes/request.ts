import { Network, displayAmount, normalizeAmount } from "@wormhole-foundation/sdk-base";
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
    return normalizeAmount(amount, BigInt(this.source.token.decimals));
  }

  displayAmount(amount: bigint): string {
    return displayAmount(
      amount,
      BigInt(this.source.token.decimals),
      BigInt(this.source.token.decimals),
    );
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
  token: {
    decimals: number;
    wrapped?: TokenId;
  };
}

async function getTokenDetails<N extends Network>(
  chain: ChainContext<N>,
  token: TokenId | "native",
): Promise<TokenDetails> {
  const tokenAddress = isTokenId(token) ? canonicalAddress(token) : token;

  const decimals = Number(await chain.getDecimals(isTokenId(token) ? token.address : token));
  let wrapped: TokenId | undefined;
  if (tokenAddress === "native") {
    wrapped = await chain.getNativeWrappedTokenId();
  }

  return {
    id: token,
    token: {
      decimals,
      wrapped,
    },
  };
}
