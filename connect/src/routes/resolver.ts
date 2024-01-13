import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest, UnknownRoute, UnknownRouteConstructor, isAutomatic } from "./route";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: UnknownRouteConstructor<N>[];

  constructor(wh: Wormhole<N>, routeConstructors: UnknownRouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async findRoutes(request: RouteTransferRequest): Promise<UnknownRoute<N>[]> {
    // Could do this faster in parallel using Promise.all
    const fromChain = this.wh.getChain(request.from.chain);
    const toChain = this.wh.getChain(request.to.chain);

    return this.routeConstructors
      .filter((rc) => rc.isSupported(fromChain, toChain))
      .map((rc) => new rc(this.wh, request, fromChain, toChain))
      .filter(async (route) => (isAutomatic(route) ? await route.isAvailable() : true));
  }

  async sortRoutes(
    routes: UnknownRoute<N>[],
    sortBy: RouteSortOptions,
  ): Promise<UnknownRoute<N>[]> {
    // TODO: actually sort
    return routes;
  }
}

/*

let resolver = new RouteResolver([
  MayanSwapRoute,
  ...DEFAULT_RESOLVERS
]);

let request = TransferRequest {
  ...
}

let routes = resolver.findRoutes(request)

*/
