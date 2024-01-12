import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "../wormhole";
import { Route, TransferRequest } from './route';

type RouteConstructor = {
  new(request: TransferRequest): Route
};

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>
  routeConstructors: RouteConstructor[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async findRoutes(request: TransferRequest): Promise<Route[]> {
    // Could do this faster in parallel using Promise.all
    return this.routeConstructors.map((rc) => {
      return new rc(request);
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
