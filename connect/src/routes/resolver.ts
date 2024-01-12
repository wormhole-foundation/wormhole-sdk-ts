import { Route, TransferRequest } from './route';

type RouteConstructor = {
  new(request: TransferRequest): Route
};

export class RouteResolver {
  routeConstructors: RouteConstructor[];

  constructor(routeConstructors: RouteConstructor[]) {
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
