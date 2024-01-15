import { Network } from "@wormhole-foundation/sdk-base";
import { Wormhole } from "../wormhole";
import {
  RouteTransferRequest,
  UnknownRoute,
  UnknownRouteConstructor,
  ChainConfig,
  isAutomatic,
} from "./route";
import { ChainAddress, isTokenId } from "@wormhole-foundation/sdk-definitions";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: UnknownRouteConstructor<N>[];

  constructor(wh: Wormhole<N>, routeConstructors: UnknownRouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async findRoutes(request: RouteTransferRequest): Promise<UnknownRoute<N>[]> {
    // Cache chain context and decimal precision level
    const chainConfigs = {
      from: await this.getChainConfig(request.from),
      to: await this.getChainConfig(request.to),
    };

    // Could do this faster in parallel using Promise.all
    return this.routeConstructors
      .map((rc) => new rc(this.wh, request, chainConfigs))
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

  // TODO move this somewhere else?
  private async getChainConfig(target: ChainAddress): Promise<ChainConfig<N>> {
    const context = this.wh.getChain(target.chain);
    const decimals = isTokenId(target)
      ? await this.wh.getDecimals(target.chain, target.address)
      : BigInt(context.config.nativeTokenDecimals);

    return { context, decimals };
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
