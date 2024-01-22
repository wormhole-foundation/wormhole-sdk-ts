import { Network } from "@wormhole-foundation/sdk-base";
import { ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import { UnknownRoute, UnknownRouteConstructor, isAutomatic } from "./route";

export type RouteSortOptions = "cost" | "speed";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: UnknownRouteConstructor<N>[];
  inputTokenList?: (TokenId | "native")[];

  constructor(wh: Wormhole<N>, routeConstructors: UnknownRouteConstructor<N>[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: ChainContext<Network>): Promise<(TokenId | "native")[]> {
    // TODO: make this a set to dedupe?
    this.inputTokenList =
      this.inputTokenList ??
      (
        await Promise.all(
          this.routeConstructors.flatMap(async (rc) => rc.supportedSourceTokens(chain)),
        )
      ).flat();
    return this.inputTokenList!;
  }

  async supportedDestinationTokens(
    inputToken: TokenId,
    fromChain: ChainContext<Network>,
    toChain: ChainContext<Network>,
  ): Promise<(TokenId | "native")[]> {
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) =>
        rc.supportedDestinationTokens(inputToken, fromChain, toChain),
      ),
    );
    return tokens.flat();
  }

  async findRoutes(request: RouteTransferRequest<N>): Promise<UnknownRoute<N>[]> {
    const matches = await Promise.all(
      this.routeConstructors
        .filter(
          (rc) =>
            rc.supportedNetworks().includes(this.wh.network) &&
            rc.supportedChains(this.wh.network).includes(request.to.chain) &&
            rc.supportedChains(this.wh.network).includes(request.from.chain) &&
            rc.isProtocolSupported(request.fromChain, request.toChain),
        )
        .map((rc) => new rc(this.wh, request))
        .map(async (route) => {
          const match = isAutomatic(route) ? await route.isAvailable() : true;
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
