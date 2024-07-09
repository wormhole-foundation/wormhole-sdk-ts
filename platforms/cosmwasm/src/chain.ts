import type { Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { CosmwasmChains } from "./types.js";

export class CosmwasmChain<
  N extends Network = Network,
  C extends CosmwasmChains = CosmwasmChains,
> extends ChainContext<N, C> {}
