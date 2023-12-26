import { Chain, ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { AlgorandChains, AlgorandPlatformType } from "./types";

export class AlgorandChain<
  N extends Network = Network,
  C extends Chain = AlgorandChains,
> extends ChainContext<N, AlgorandPlatformType, C> {}
