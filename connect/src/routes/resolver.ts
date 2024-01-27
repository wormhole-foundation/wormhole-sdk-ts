import { Network } from "@wormhole-foundation/sdk-base";
import { Ctx, TokenId, resolveWrappedToken } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import { Route, RouteConstructor, isAutomatic } from "./route";
import { uniqueTokens } from "./token";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: RouteConstructor[];
  inputTokenList?: TokenId[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: Ctx<N>): Promise<TokenId[]> {
    if (this.inputTokenList) return this.inputTokenList;
    const itl = await Promise.all(
      this.routeConstructors.map(async (rc) => rc.supportedSourceTokens(chain)),
    );
    this.inputTokenList = uniqueTokens(itl.flat());
    return this.inputTokenList!;
  }

  async supportedDestinationTokens(
    inputToken: TokenId,
    fromChain: Ctx<N>,
    toChain: Ctx<N>,
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
