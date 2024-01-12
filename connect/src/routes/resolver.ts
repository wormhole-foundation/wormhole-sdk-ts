import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "../wormhole";
import { Route, TransferRequest } from './route';

type RouteConstructor<N extends Network> = {
  new(wh: Wormhole<N>, request: TransferRequest): Route<N>
};

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>
  routeConstructors: RouteConstructor<N>[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async findRoutes(request: TransferRequest): Promise<Route<N>[]> {
    // Could do this faster in parallel using Promise.all
    return this.routeConstructors.map((rc) => {
      return new rc(this.wh, request);
    }).filter(async (route) => {
      return await route.isSupported() && await route.isAvailable()
    });
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
