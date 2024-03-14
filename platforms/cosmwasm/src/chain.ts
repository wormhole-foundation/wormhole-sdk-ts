import type { Chain, Network } from "@wormhole-foundation/sdk-connect";
import { ChainContext } from "@wormhole-foundation/sdk-connect";
import type { CosmwasmChains } from "./types.js";

export class CosmwasmChain<
  N extends Network = Network,
  C extends Chain = CosmwasmChains,
> extends ChainContext<N, C> {}
