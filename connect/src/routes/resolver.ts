import { Chain, Network } from "@wormhole-foundation/sdk-base";
import {
  ChainContext,
  TokenId,
  canonicalAddress,
  resolveWrappedToken,
} from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import { Route, RouteConstructor, isAutomatic } from "./route";

export type RouteSortOptions = "cost" | "speed";

export function uniqueTokens<C extends Chain>(tokens: TokenId<C>[]): TokenId<C>[] {
  if (tokens.length === 0) return [];

  // take the first chain, all should be equal
  const { chain } = tokens[0]!;

  if (!tokens.every((t) => t.chain === chain)) throw new Error("Not every chain is equal");

  return Array.from(new Set(tokens.map((t) => canonicalAddress(t)))).map((a) =>
    Wormhole.tokenId(chain, a),
  );
}

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: RouteConstructor[];
  inputTokenList?: TokenId[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: ChainContext<Network>): Promise<TokenId[]> {
    if (this.inputTokenList) return this.inputTokenList;
    const itl = await Promise.all(
      this.routeConstructors.flatMap(async (rc) => rc.supportedSourceTokens(chain)),
    );

    this.inputTokenList = uniqueTokens(itl.flat());
    return this.inputTokenList!;
  }

  async supportedDestinationTokens(
    inputToken: TokenId,
    fromChain: ChainContext<Network>,
    toChain: ChainContext<Network>,
  ): Promise<TokenId[]> {
    const [, inputTokenId] = resolveWrappedToken(fromChain.network, fromChain.chain, inputToken);
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) =>
        rc.supportedDestinationTokens(inputTokenId, fromChain, toChain),
      ),
    );
    return uniqueTokens(tokens.flat());
  }

  async findRoutes(request: RouteTransferRequest<N>): Promise<Route<N>[]> {
    const matches = await Promise.all(
      this.routeConstructors
        .filter(
          (rc) =>
            rc.supportedNetworks().includes(this.wh.network) &&
            rc.supportedChains(this.wh.network).includes(request.to.chain) &&
            rc.supportedChains(this.wh.network).includes(request.from.chain) &&
            rc.isProtocolSupported(request.fromChain) &&
            rc.isProtocolSupported(request.toChain),
        )
        .map((rc) => new rc(this.wh, request))
        .map(async (route) => {
          const match = isAutomatic(route) ? await route.isAvailable() : true;
          return [match, match ? route : undefined] as [true, Route<N>] | [false, undefined];
        }),
    );
    return matches.filter(([match]) => match).map(([, route]) => route!);
  }

  async sortRoutes(routes: Route<N>[], sortBy: RouteSortOptions): Promise<Route<N>[]> {
    // TODO: actually sort
    return routes;
  }
}
