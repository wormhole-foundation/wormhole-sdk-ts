import { Chain, ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { AlgorandChains } from "./types";

export class AlgorandChain<
  N extends Network = Network,
  C extends Chain = AlgorandChains,
> extends ChainContext<N, "Algorand", C> {}
