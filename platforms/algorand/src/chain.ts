import { ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { AlgorandChains } from "./types";

export class AlgorandChain<
  N extends Network = Network,
  C extends AlgorandChains = AlgorandChains,
> extends ChainContext<N, C> {}
