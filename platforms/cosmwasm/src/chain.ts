import { Chain, ChainContext, Network } from "@wormhole-foundation/sdk-connect";
import { CosmwasmChains } from "./types";

export class CosmwasmChain<
  N extends Network = Network,
  C extends Chain = CosmwasmChains,
> extends ChainContext<N, C> {}
