import { Chain, ChainContext, Network } from "@wormhole-foundation/connect-sdk";
import { CosmwasmChains, CosmwasmPlatformType } from "./types";

export class CosmwasmChain<
  N extends Network = Network,
  C extends Chain = CosmwasmChains,
> extends ChainContext<N, CosmwasmPlatformType, C> {}
