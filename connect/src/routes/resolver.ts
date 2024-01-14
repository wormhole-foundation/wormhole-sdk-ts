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
    return this.routeConstructors
      .map((rc) => new rc(this.wh, request))
      .filter(async (route) => {
        if (!(await route.isSupported())) return false;
        if (isAutomatic(route) && !(await route.isAvailable())) return false;
        return true;
      });
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
