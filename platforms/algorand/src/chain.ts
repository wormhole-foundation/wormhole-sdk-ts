import type { Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { AlgorandChains } from "./types.js";

export class AlgorandChain<
  N extends Network = Network,
  C extends AlgorandChains = AlgorandChains,
> extends ChainContext<N, C> {}
