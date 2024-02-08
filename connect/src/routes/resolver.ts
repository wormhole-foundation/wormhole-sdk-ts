import { Network } from "@wormhole-foundation/sdk-base";
import { ChainContext, TokenId, resolveWrappedToken } from "@wormhole-foundation/sdk-definitions";
import { Wormhole } from "../wormhole";
import { RouteTransferRequest } from "./request";
import { Route, RouteConstructor, isAutomatic } from "./route";
import { uniqueTokens } from "./token";
import { Receipt, Options, ValidatedTransferParams } from "./types";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: RouteConstructor[];
  inputTokenList?: TokenId[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: ChainContext<Network>): Promise<TokenId[]> {
    if (this.inputTokenList) return this.inputTokenList;
    const itl = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        try {
          return await rc.supportedSourceTokens(chain);
        } catch (e) {
          console.error(`Failed to get supported tokens for ${rc.meta.name}: `, e);
          return [];
        }
      }),
    );
    this.inputTokenList = uniqueTokens(itl.flat());
    return this.inputTokenList!;
  }

  async supportedDestinationTokens(
    inputToken: TokenId,
    fromChain: ChainContext<Network>,
    toChain: ChainContext<Network>,
  ): Promise<TokenId[]> {
    const [, inputTokenId] = resolveWrappedToken(fromChain.network, fromChain.chain, inputToken);
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        try {
          return await rc.supportedDestinationTokens(inputTokenId, fromChain, toChain);
        } catch (e) {
          console.error(`Failed to get supported tokens for ${rc.meta.name}: `, e);
          return [];
        }
      }),
    );
    return uniqueTokens(tokens.flat());
  }

  async findRoutes(request: RouteTransferRequest<N>): Promise<Route<N>[]> {
    // First we find all routes which support the request inputs (network, chains, and tokens)
    const supportedRoutes = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        try {
          const protocolSupported =
            rc.supportedNetworks().includes(this.wh.network) &&
            rc.supportedChains(this.wh.network).includes(request.to.chain) &&
            rc.supportedChains(this.wh.network).includes(request.from.chain) &&
            rc.isProtocolSupported(request.fromChain) &&
            rc.isProtocolSupported(request.toChain);

          const sourceTokenSupported =
            (await rc.supportedSourceTokens(request.fromChain)).filter((tokenId: TokenId) => {
              return tokenId.address.toString() === request.source.id.address.toString();
            }).length > 0;

          const destinationTokenSupported =
            (
              await rc.supportedDestinationTokens(
                request.source.id,
                request.fromChain,
                request.toChain,
              )
            ).filter((tokenId: TokenId) => {
              return tokenId.address.toString() === request.destination.id.address.toString();
            }).length > 0;

          return protocolSupported && sourceTokenSupported && destinationTokenSupported;
        } catch (e) {
          return false;
        }
      }),
    ).then((routesSupported) =>
      this.routeConstructors.filter((_, index) => routesSupported[index]),
    );

    // Next, we make sure all supported routes are available. For relayed routes, this will ping
    // the relayer to make sure it's online.
    return await Promise.all(
      supportedRoutes.map(
        async (
          rc,
        ): Promise<[Route<N, Options, ValidatedTransferParams<Options>, Receipt>, boolean]> => {
          const route = new rc(this.wh, request);
          try {
            const available = isAutomatic(route) ? await route.isAvailable() : true;
            return [route, available];
          } catch (e) {
            console.error(`Failed to get route for ${rc.meta.name}: `, e);
            return [route, false];
          }
        },
      ),
    )
      .then((availableRoutes) => availableRoutes.filter(([_, available]) => available))
      .then((availableRoutes) => availableRoutes.map(([route, _]) => route!));
  }
}
