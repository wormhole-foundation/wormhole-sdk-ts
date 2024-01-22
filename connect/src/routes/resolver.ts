import { Chain, Network } from "@wormhole-foundation/sdk-base";
import { TokenId } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import { UnknownRoute, UnknownRouteConstructor, isAutomatic } from "./route";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: UnknownRouteConstructor<N>[];
  inputTokenList?: TokenId[];

  constructor(wh: Wormhole<N>, routeConstructors: UnknownRouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: Chain): Promise<TokenId[]> {
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        return await rc.supportedSourceTokens(chain);
      }),
    );
    return tokens.flat();
  }

  async supportedDestinationTokens(inputToken: TokenId, toChain: Chain): Promise<TokenId[]> {
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        return await rc.supportedDestinationTokens(inputToken, toChain);
      }),
    );
    return tokens.flat();
  }

  async findRoutes(request: RouteTransferRequest<N>): Promise<UnknownRoute<N>[]> {
    const matches = await Promise.all(
      this.routeConstructors
        .map((rc) => new rc(this.wh, request))
        .map(async (route) => {
          const match =
            (await route.isSupported()) && (!isAutomatic(route) || (await route.isAvailable()));
          return [match, match ? route : undefined] as [true, UnknownRoute<N>] | [false, undefined];
        }),
    );
    return matches.filter(([match]) => match).map(([, route]) => route!);
  }

  async sortRoutes(
    routes: UnknownRoute<N>[],
    sortBy: RouteSortOptions,
  ): Promise<UnknownRoute<N>[]> {
    // TODO: actually sort
    return routes;
  }
}
