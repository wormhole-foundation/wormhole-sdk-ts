import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "../wormhole";
import { UnknownRoute, UnknownRouteConstructor, isAutomatic } from "./route";
import { RouteTransferRequest } from "./request";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: UnknownRouteConstructor<N>[];

  constructor(wh: Wormhole<N>, routeConstructors: UnknownRouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async findRoutes(request: RouteTransferRequest<N>): Promise<UnknownRoute<N>[]> {
    // Could do this faster in parallel using Promise.all
    return this.routeConstructors
      .map((rc) => new rc(this.wh, request))
      .filter(async (route) =>
        (await route.isSupported()) && (!isAutomatic(route) || (await route.isAvailable()))
      );
  }

  async sortRoutes(
    routes: UnknownRoute<N>[],
    sortBy: RouteSortOptions,
  ): Promise<UnknownRoute<N>[]> {
    // TODO: actually sort
    return routes;
  }
}
