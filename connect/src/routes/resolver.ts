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
    const matches = await Promise.all(
      this.routeConstructors
        .map((rc) => new rc(this.wh, request))
        .map(async (route) => {
          const match =
            (await route.isSupported()) && (!isAutomatic(route) || (await route.isAvailable()));
          return [match, match ? route : undefined] as [boolean, UnknownRoute<N>];
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
