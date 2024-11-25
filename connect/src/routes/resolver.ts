import type { Network } from "@wormhole-foundation/sdk-base";
import type { ChainContext, TokenId } from "@wormhole-foundation/sdk-definitions";
import {
  canonicalAddress,
  isNative,
  resolveWrappedToken,
} from "@wormhole-foundation/sdk-definitions";
import type { Wormhole } from "../wormhole.js";
import type { RouteTransferRequest } from "./request.js";
import type { Route, RouteConstructor } from "./route.js";
import { uniqueTokens } from "./token.js";

export class RouteResolver<N extends Network> {
  wh: Wormhole<N>;
  routeConstructors: RouteConstructor[];
  inputTokenList?: TokenId[];

  constructor(wh: Wormhole<N>, routeConstructors: RouteConstructor[]) {
    this.wh = wh;
    this.routeConstructors = routeConstructors;
  }

  async supportedSourceTokens(chain: ChainContext<N>): Promise<TokenId[]> {
    if (this.inputTokenList) return this.inputTokenList;
    const itl = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        try {
          return await rc.supportedSourceTokens(chain);
        } catch (e) {
          console.error(`Failed to get supported source tokens for ${rc.meta.name}: `, e);
          return [];
        }
      }),
    );
    this.inputTokenList = uniqueTokens(itl.flat());
    return this.inputTokenList!;
  }

  async supportedDestinationTokens(
    inputToken: TokenId,
    fromChain: ChainContext<N>,
    toChain: ChainContext<N>,
  ): Promise<TokenId[]> {
    const [, inputTokenId] = resolveWrappedToken(fromChain.network, fromChain.chain, inputToken);
    const tokens = await Promise.all(
      this.routeConstructors.map(async (rc) => {
        const supportedNetworks = rc.supportedNetworks();
        if (!supportedNetworks.includes(fromChain.network)) {
          return [];
        }

        const supportedChains = rc.supportedChains(fromChain.network);
        if (!supportedChains.includes(fromChain.chain) || !supportedChains.includes(toChain.chain)) {
          return [];
        }

        try {
          return await rc.supportedDestinationTokens(inputTokenId, fromChain, toChain);
        } catch (e) {
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
            rc.supportedChains(this.wh.network).includes(request.toChain.chain) &&
            rc.supportedChains(this.wh.network).includes(request.fromChain.chain)

          const sourceTokenAddress = canonicalAddress(
            isNative(request.source.id.address) ? request.source.wrapped! : request.source.id,
          );

          const sourceTokenSupported =
            (await rc.supportedSourceTokens(request.fromChain)).filter((tokenId: TokenId) => {
              return canonicalAddress(tokenId) === sourceTokenAddress;
            }).length > 0;

          const dstTokenAddress = canonicalAddress(
            isNative(request.destination.id.address)
              ? request.destination.wrapped!
              : request.destination.id,
          );
          const destinationTokenSupported =
            (
              await rc.supportedDestinationTokens(
                request.source.id,
                request.fromChain,
                request.toChain,
              )
            ).filter((tokenId: TokenId) => {
              return canonicalAddress(tokenId) === dstTokenAddress;
            }).length > 0;

          return protocolSupported && sourceTokenSupported && destinationTokenSupported;
        } catch (e) {
          return false;
        }
      }),
    ).then((routesSupported) =>
      this.routeConstructors.filter((_, index) => routesSupported[index]),
    );

    return supportedRoutes.map((rc) => new rc(this.wh));
  }
}
